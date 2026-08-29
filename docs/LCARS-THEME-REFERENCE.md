# Version 28.3 LCARS Display Matrix reference

The Version 28.3 Display Matrix is limited to computer interfaces shown as Starfleet LCARS or an LCARS PADD. It does not treat every Star Trek computer graphic as LCARS, and it does not reproduce copyrighted screen captures or production artwork. The implementation translates recurring on-screen design traits into original CSS geometry around LCARSCI's real controls.

## Included families

### Enterprise-D — TNG Galaxy-class

- Basis: the original Michael Okuda LCARS language used on the Enterprise-D.
- LCARSCI treatment: broad warm-color bands, large rounded elbows, asymmetric control bays, and generous spacing.
- Production reference: [Star Trek Archaeology with Michael and Denise Okuda](https://www.startrek.com/news/star-trek-archeology-with-the-okudas) and the [Okuda-designed Star Trek Set Tour panels](https://blog.trekcore.com/2022/08/star-trek-set-tour-unveils-first-next-generation-set-builds/).

### Voyager — Intrepid-class

- Basis: Starfleet LCARS aboard the USS Voyager, designed within the same production lineage as TNG but used in denser, compact late-24th-century bridge stations.
- LCARSCI treatment: narrower rails, cooler blue structural emphasis, smaller radii, tighter controls, and higher information density.
- Production reference: StarTrek.com's [official PADD feature](https://www.startrek.com/videos/star-trek-padd-app-available-today), which identifies Michael Okuda as the official designer of the LCARS displays used in TNG, DS9, and Voyager.

### Enterprise-E — Nemesis

- Basis: the predominantly blue Starfleet LCARS seen aboard the Sovereign-class Enterprise-E in *Star Trek: Nemesis*.
- LCARSCI treatment: squared panes, thin cyan rules, dark blue tactical glass, compact navigation, and restrained rounded bands.
- Visual reference: [Nemesis LCARS panel catalog](https://www.lcars.org.uk/lcars_TNG_Films_panels.htm) and [TrekCore's Nemesis production archive](https://movies.trekcore.com/nemesis/behindthescenes.html).

### Picard Starfleet — LCARS 2.0, 2401

- Basis: Starfleet screens aboard Picard-era ships, especially the USS Titan-A and fleet systems—not La Sirena.
- LCARSCI treatment: a very dark field, fine amber and muted red tracery, hairline frames, small segmented modules, dense grids, and limited solid-color mass.
- Production references: Picard screen designer Andrew Jarvis describes developing LCARS twenty years forward in his [season-one FUI portfolio](https://ion.studio/fui-design). Picard screen designer Noah Schloss describes LCARS 2.0, daily use of the TNG Technical Manual, and Michael Okuda's later guidance in [this production interview](https://www.pushing-pixels.org/2023/04/30/the-art-and-craft-of-screen-graphics-interview-with-noah-schloss.html). The Art Directors Guild's [Picard season-three submission](https://assets.adg.org/media/submissions/2023-09-30_21-38-05/ADG_PICARD.pdf) credits Mike Okuda as LCARS graphic designer.

### Cerritos — Lower Decks California-class

- Basis: the USS Cerritos' animated Starfleet LCARS, which deliberately carries the late-24th-century Starfleet language into a flat animated style.
- LCARSCI treatment: saturated flat color, bold dark outlines, larger pill shapes, exaggerated curves, and stronger selected states.
- Production reference: TrekCore's [Lower Decks season-one art-design coverage](https://blog.trekcore.com/2021/05/star-trek-lower-decks-season1-bluray-review/) notes that even the Cerritos furniture was shaped to echo LCARS; the [Lower Decks screencap archive](https://lowerdecks.trekcore.com/gallery/) supplies episode-by-episode on-screen visual reference.

### TNG PADD — handheld LCARS

- Basis: the handheld Personal Access Display Devices seen in TNG and an official functional LCARS PADD implementation approved by Michael and Denise Okuda.
- LCARSCI treatment: a thick framed slab, compact button banks, touch-first navigation, and the desktop rail reorganized into a multi-row control bay.
- Production references: StarTrek.com's [archive of communicators and PADDs](https://www.startrek.com/en-un/gallery/star-trek-archive-okudagrams) and [official Star Trek PADD feature](https://www.startrek.com/videos/star-trek-padd-app-available-today).

## Explicit exclusions

- Deep Space 9 station controls are Cardassian interfaces, not LCARS. Federation systems aboard Starfleet vessels such as the Defiant are a separate case, but no “DS9 station” theme is included.
- La Sirena's free-floating holographic controls are not used as the Picard LCARS reference. The Picard theme is restricted to identified Starfleet LCARS.
- Enterprise NX-01, Discovery-era interfaces, Original Series consoles, Klingon, Romulan, Borg, Cardassian, and other alien systems are not presented as LCARS themes.
- Fan-made LCARS is used only as a search lead when necessary, never as the authority for an era's visual definition.

## Implementation rule

Every Display Matrix family must change at least four structural dimensions: shell geometry, navigation geometry, panel/border treatment, and information density. A palette-only variant does not qualify as a theme in Version 28.3.
