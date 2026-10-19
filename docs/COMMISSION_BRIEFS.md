# Commission briefs (DRAFT)

Status: **DRAFT for owner review, uncommitted, not sent.** Written 2026-10-15. No artist has been contacted, no request published, no quote agreed, no money spent.

Fields in `[OWNER: ...]` are decisions only the owner can make. Remove this header before any brief leaves the project.

Shared context for both briefs:

- **Game:** Naija Hunt, a mobile-first, browser-based 3D Nigerian treasure-hunting game (Three.js, React Three Fiber). Assets are delivered to the player's browser as glTF/GLB files.
- **Art direction:** "realistic-stylized", never photorealism. Rich materials and believable light, simplified forms, readable at a distance. Reference images guide composition, detail and mood only.
- **Reference images:** **Not to be shared with any contractor without the owner's explicit approval.** [OWNER: confirm you hold the rights to share these with a contractor, and which of the four to share. They are kept local and uncommitted.]
- **Budget and timeline:** [OWNER: fixed fee ceiling, currency, milestone dates]

---

## Brief 1: Modular Lagos-inspired building and street kit, danfo and palms

### Goal

A small set of modular, web-ready 3D environment assets that together build one cinematic Nigerian urban junction at golden hour. The kit must read as Lagos-inspired through architecture, materials and signage, not through generic "African village" shortcuts.

This brief also covers the hero danfo minibus and the street palms. Earlier candidates for both were set aside by the owner because their provenance could not be confirmed, so **both must be fully original work**.

Until these assets arrive, the game uses clearly labelled placeholders. The commissioned assets replace them one for one.

### Deliverables

All dimensions are in metres, +Y up, one unit equals one metre, pivots on the ground.

1. **Low-rise commercial buildings (3 variants).** Two to three storeys, shopfront at street level. Details to research and confirm with the artist's own Lagos references: window grilles and louvre windows, painted perimeter walls, corrugated metal roofs, rooftop water tanks, external stairs, wall-mounted split air-conditioner units, hand-painted shop-sign panels.
2. **Mural wall module.** A blank wall module with a dedicated texture slot for a large mural. The mural itself is original artwork. It must not copy any reference image.
3. **Elevated roadway (flyover) modules.** Pier, deck segment and barrier, tileable along one axis.
4. **Street furniture.** A road-sign gantry with swappable sign panels, two market-stall frames with canopy or umbrella variants, one kiosk, a utility pole with sagging cable meshes.
5. **Trim and tiling textures** reused across the kit to keep texture memory low.
6. **Hero danfo minibus.** One detailed vehicle plus one colour or wear variant. Yellow body with the black stripe and the worn, scuffed, dented character shown in the owner's environment reference. Separate wheels and doors so they can be animated. Body, windows and lights as separate materials. About 10,000 to 15,000 triangles for the hero and about 3,000 to 5,000 for a distance version (owner's proposals). Fully original: it must not be based on an AI-generated model, a scan, or a ripped game asset. Any lettering on the body is fictional or supplied by the owner.
7. **Street palms.** Two to three tall street-palm variants. Species to be agreed with the artist from their own Lagos references. About 1,500 to 3,000 triangles each, leaf cards allowed, textures of 1024 or less. Fronds separable or vertex-painted so wind sway can be added in code. Fully original.

### Technical specification (owner's proposals, open to artist input)

- File: glTF 2.0 binary (`.glb`), metal-rough PBR, one UV set plus an optional second UV set for baked ambient occlusion.
- Textures: JPG or PNG, power-of-two, maximum 2048 for hero surfaces and 1024 elsewhere. Roughness, ambient occlusion and metalness packed into one image (ARM) where possible. Normal maps in OpenGL (+Y) convention.
- Budget per building: about 8,000 to 12,000 triangles. The whole kit combined must stay within the limits agreed in the quote.
- Materials: as few as possible per asset, ideally one material per building.
- Modularity: state the grid and snapping rule. Provide an assembled preview scene plus individual parts.
- Naming: clear and consistent. No spaces. No hidden or leftover objects.
- No baked-in lighting from a specific time of day in the base colour texture (a separate AO bake is fine).
- Optional: one lower-detail version of each building for distance.

### Acceptance criteria

1. Each GLB opens without errors in the Khronos glTF validator and loads in Three.js `GLTFLoader`.
2. Triangle and texture budgets are met and reported per asset.
3. Scale check: a door is about 2.0 m high, a storey about 3 m.
4. Rendered preview supplied from a neutral light setup and from a warm low sun.
5. All source files delivered (Blender `.blend` preferred) with textures at full resolution.

### Rights and warranties required in the quote

- **Full assignment of copyright, or an exclusive perpetual licence that explicitly covers: delivery to players' browsers, commercial use, modification, and derivative works.** State which.
- Artist warrants the work is original, contains **no AI-generated content (or discloses exactly what was used)**, and contains no ripped or third-party assets. Any third-party material (textures, fonts, brands) must be listed with its licence.
- No real brands or logos. Signage text is supplied by the owner or is clearly fictional.
- Whether the artist may show the work in a portfolio, and when. [OWNER: yes / no / after release]
- Credit: optional. [OWNER: whether the artist is credited in the Credits screen]

### Quote request

Please respond with:

1. Fixed price per deliverable and in total, and what is excluded.
2. Milestone plan: blockout approval, textured models, final export, with the number of revision rounds included.
3. Estimated delivery time.
4. Two or more examples of your own real-time environment work, with triangle counts and texture sizes.
5. Your rights position on the points above.
6. Any questions about Lagos architecture where you would like input.

---

## Brief 2: Nigerian protagonist

### Goal

A single playable character, a Nigerian male explorer, ready for a browser game on desktop and mid-range phones. The design follows the owner's character reference sheet (close-up plus front, side and back turnaround).

### Design

- Adult Nigerian man, short hair, friendly and capable expression.
- Green hooded jacket over a grey tee, khaki cargo trousers, boots, a backpack.
- The look should be respectful and specific, not a stereotype. The artist is encouraged to flag anything in the reference that reads as inaccurate.
- The character is fictional. If the face is based on a real person, a signed model release is required. [OWNER: confirm the character is not based on a real person]

### Deliverables

1. One rigged character in `.glb` (glTF 2.0): standard humanoid skeleton, A-pose or T-pose bind pose, clean weights.
2. **Animation clips, authored by the artist** (not downloaded from a library): idle, walk, run. Looping, in place (no root drift), named `idle`, `walk` and `run`. Optional extras for a quote: look-around, interact, jump. Any animation tool or library used must be declared with its licence.
3. A separate attachable backpack mesh or a clear bone for it.
4. Textures: PBR, base colour, normal and ARM maps, maximum 2048, one to three materials total.
5. Source files (Blender `.blend` preferred) and a turntable render.
6. Optional: one lower-detail version for distance.

### Technical specification (owner's proposals, open to artist input)

- Triangles: about 15,000 to 25,000 for the main version, about 6,000 for the optional lower-detail version.
- Skeleton: named, documented, humanoid. Compatible with common retargeting tools, **without depending on Mixamo**.
- Eyes and hands: readable at the game camera distance (third-person, a few metres away).
- Blink or simple facial blend shapes are optional.
- Loads in Three.js `GLTFLoader` and plays through `AnimationMixer` with no extra setup.

### Acceptance criteria

1. Passes the Khronos glTF validator and loads and animates in Three.js.
2. Silhouette and outfit match the reference sheet in front, side and back views.
3. No visible deformation problems in idle, walk and run.
4. Triangle and texture budgets are met and reported.
5. Rights and warranties as below.

### Rights and warranties required in the quote

- Full assignment of copyright, or an exclusive perpetual licence that explicitly covers: delivery to players' browsers, commercial use, modification and derivative works, **and use of the character's likeness and design in marketing and in the game**.
- Artist warrants originality, **no AI-generated content (or exact disclosure)**, and no ripped or third-party assets. Any third-party material must be listed with its licence.
- Portfolio use and credit as in Brief 1. [OWNER: decide]

### Quote request

Please respond with:

1. Fixed price for the model, rig and each animation clip, plus optional items priced separately.
2. Milestone plan: concept confirmation, blockout, textured model, rig, animations, final export, with the number of revision rounds included.
3. Estimated delivery time.
4. Two or more examples of your rigged game-ready characters, with triangle counts and the animation they shipped with.
5. Your rights position on the points above, including likeness and animation ownership.
