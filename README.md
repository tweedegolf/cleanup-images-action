## Cleanup of old data in the container registry

The GitHub container registry does not automatically remove old tags or untagged
images from itself. To do this, we can setup an actions workflow that does this
for us automatically. There are two steps to this process. First, we remove any
tags that are no longer needed by adding any number of jobs refering to the
`cleanup-images-action` step. Finally we finish by adding a single
`cleanup-untagged-images-action` step. Of course, if your image creation
workflow never creates any new tags but instead always reuses the existing ones
there is no need to include any of the tag cleanup workflows. Let's look at an
example:

```yaml
name: Container Registry Cleanup

permissions:
  contents: read
  packages: write

on:
  workflow_dispatch:
  schedule:
    - cron: '30 2 * * MON'

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: "tweedegolf/cleanup-images-action@main"
        with:
          package: debian
          filter: |-
            ^stable-\\d{2}-\\d{2}-\\d{4}$
            ^nightly-\\d{2}-\\d{2}-\\d{4}$
          keep_n: 5
      - uses: "tweedegolf/cleanup-untagged-images-action@main"
        with:
          package: debian
```

In this example, we run a cleanup job that removes old nightly tagged images
first, and then removes any remaining untagged images after that. Note how this
action is only run on a schedule once a week, there is no need to run it after
every main branch update or every pull request unless lots of container builds
are happening on your repository.

### Tag cleanup step inputs
This step has several parameters that allow customizing the behavior:

<table>
  <thead>
    <tr><th>Option</th><th>Required</th><th>Default</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><code>package</code></td>
      <td>yes</td>
      <td></td>
    </tr>
    <tr><td colspan="3">
      Name of the container registry package
    </td></tr>
    <tr>
      <td><code>filters</code></td>
      <td>yes</td>
      <td></td>
    </tr>
    <tr><td colspan="3">
      A newline separated list of regular expressions matching some specific tags for the container
    </td></tr>
    <tr>
      <td><code>keep_n</code></td>
      <td>yes</td>
      <td></td>
    </tr>
    <tr><td colspan="3">
      How many of the most recently created and matched tags to keep (if
      non-negative).
    </td></tr>
    <tr>
      <td><code>older_than</code></td>
      <td>no</td>
      <td><code>-1</code></td>
    </tr>
    <tr><td colspan="3">
      Only remove untagged container images at least as old as this (in days),
      only works if larger than zero.
    </td></tr>
  </tbody>
</table>
