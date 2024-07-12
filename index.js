const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  const packageName = core.getInput('package');
  const owner = github.context.repo.owner;
  const filters = core
    .getInput('filters')
    .split('\n')
    .map((f) => new RegExp(f.trim()));
  const keepN = core.getInput('keep_n');
  const olderThan = core.getInput('older_than');
  const token = core.getInput('token');
  // calculate older than time
  const olderThanTime = new Date();
  olderThanTime.setDate(olderThanTime.getDate() - olderThan);
  // fetch all packages
  const octokit = github.getOctokit(token);
  const packages = await octokit.paginate(
    octokit.rest.packages.getAllPackageVersionsForPackageOwnedByOrg,
    {
      package_type: 'container',
      package_name: packageName,
      org: owner,
      per_page: 100,
    }
  );
  // only handle container images
  const containerImages = packages.filter(
    (p) => p.metadata?.package_type === 'container'
  );
  // always keep images that have no tag or that do not match any filter
  const globalKeep = containerImages.filter((p) => {
    const tags = p.metadata?.container?.tags ?? [];
    if (tags.length === 0) {
      return true;
    }

    return tags.some((t) => !filters.some((f) => f.test(t)));
  });
  console.log(`Found ${containerImages.length} images if which ${globalKeep.length} do not match any filter or have no tags`);
  // list images to keep per filter
  const filterKeep = filters.flatMap((filter) => {
    const keep = containerImages
      .filter((p) => {
        const tags = p.metadata?.container?.tags ?? [];
        if (tags.length === 0) {
          return false;
        }

        return tags.some((t) => filter.test(t));
      })
      // sort on date
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      // keep newest
      .filter((p, index) => {
        const isRecent =
          olderThan > 0 ? new Date(p.created_at) > olderThanTime : false;

        return isRecent || index < keepN;
      });

    const list = keep.map((p) => `${p.id}-(${p.metadata.container.tags.join('+')})`);
    console.log(`Keeping [${list.join(', ')}] for filter ${filter}`);

    return keep;
});
  // list all images that do not have to be kept
  const keepIds = [...globalKeep, ...filterKeep].map((p) => p.id);
  const removeImages = containerImages.filter((p) => !keepIds.includes(p.id));
  // remove the images
  console.log(`Found ${removeImages.length} tagged images to remove`);
  for (const r of removeImages) {
    await octokit.rest.packages.deletePackageVersionForOrg({
      package_type: 'container',
      package_name: packageName,
      org: owner,
      package_version_id: r.id,
    });
    console.log(
      `Deleted container image '${
        r.name
      }' (with tags: ${r.metadata.container.tags.join(', ')})`
    );
  }
}

run().catch((e) => core.setFailed(e.message));
