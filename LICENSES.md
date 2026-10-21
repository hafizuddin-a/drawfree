# Third-party art and licences

Drawfree's own code and original art are under the MIT licence (see `LICENSE`).

## Open Peeps

The hairstyles (which include the head), expressions, facial hair and glasses come from
**Open Peeps** by Pablo Stanley, https://www.openpeeps.com.

Open Peeps is released under **CC0 1.0 Universal** (public domain dedication):
https://creativecommons.org/publicdomain/zero/1.0/

> The person who associated a work with this deed has dedicated the work to the public domain by waiving
> all of his or her rights to the work worldwide under copyright law, including all related and neighboring
> rights, to the extent allowed by law. You can copy, modify, distribute and perform the work, even for
> commercial purposes, all without asking permission.

Attribution is not required, but we credit the work anyway: thank you, Pablo.

How the art gets into Drawfree: `tools/import-peeps.ts` reads the downloaded pack from `assets/open-peeps/`
(kept out of git), converts each piece into the editor's coordinate space and writes `src/parts/peeps/*.gen.ts`.
It also splits the pack's single white fill into skin, hair and hat areas so they can be recoloured. Those
are modifications of CC0 art, and the modified files are covered by the same CC0 dedication.
