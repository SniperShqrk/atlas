# Third-party licences

## Anatomical muscle-map paths

`app/src/data/bodyPaths.ts` contains SVG path data vendored from
[react-native-body-highlighter](https://www.npmjs.com/package/react-native-body-highlighter)
v3.2.0. The paths are used as-is; the only modification is that the single
`deltoids` region is subdivided at render time into anterior, lateral and
posterior heads (see `DELTOID_SPLIT` in that file).

```
MIT License

Copyright (c) 2022 ELABBASSI Hicham

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```


## Share card backdrop artwork

Four objects from the Metropolitan Museum of Art's Open Access collection back the share cards.
Deliberately not statues or busts — a wreath, a column, a cuirass and a helmet carry the same
classical register without ever putting a body in frame. Each was verified against the Met's own
collection API (`collectionapi.metmuseum.org`) and reports `isPublicDomain: true`. Under the Met's
Open Access policy, in force since 7 February 2017, such images are released **CC0**: free to
download, remix and use commercially, with no permission required and no attribution required.

| Work | Met object | Culture | Date |
| --- | --- | --- | --- |
| Gold funerary wreath | [254968](https://www.metmuseum.org/art/collection/search/254968) | Roman | 1st–2nd century CE |
| Marble column with base and capital | [250646](https://www.metmuseum.org/art/collection/search/250646) | Roman | ca. 117–138 CE |
| Bronze cuirass (body armor) | [256134](https://www.metmuseum.org/art/collection/search/256134) | Greek, Apulian | 4th century BCE |
| Bronze helmet of the Corinthian type | [247983](https://www.metmuseum.org/art/collection/search/247983) | Greek, Corinthian | late 7th–6th century BCE |

The objects are between roughly 1,900 and 2,700 years old, so copyright was only ever a question
about the photographs — which is precisely why these come from an open-access museum programme
rather than from an image search. Attribution is not required; ATLAS prints it anyway, on the share
screen, because naming the source costs one line.

**The images are not committed.** `app/tools/fetch-artwork.ts` downloads them, re-checks the
public-domain flag at fetch time (a work that ever loses that status fails the run rather than
silently shipping), grades them and generates `app/src/share/artworkAssets.ts`. Until it has been
run, the cards fall back to procedural marble.
