/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 86:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 46:
/***/ ((module) => {

module.exports = eval("require")("@actions/github");


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
const core = __nccwpck_require__(86);
const github = __nccwpck_require__(46);

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
  // list images to keep per filter
  const filterKeep = filters.flatMap((filter) =>
    containerImages
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
      })
  );
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

})();

module.exports = __webpack_exports__;
/******/ })()
;