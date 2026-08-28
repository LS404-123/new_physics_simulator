# AI Physics Classroom and Simulator Instructions

## Simulator Objective

Target a specific barrier to understanding and present physical evidence that corrects the misconception under syllabus of HKDSE physics.

When creating a simulator, follow these non-negotiable requirements:

1. **Four prerequisites**: Confirm the specific learning difficulty, the misunderstanding, the pre-observation prediction(it can be a question to answer, or a simulation that required them to conclude), and the key physical evidence before implementing. If anything is missing, ask only one focused question at a time.
2. **Canvas baseline**:
   - Use a fixed **`1140×768 CSS px`** iPad Air landscape canvas with an effective scale of 1. Horizontal and vertical scrolling are strictly prohibited within the target baseline viewport.
   - Arrange each section—the main physics area, chart area, and control panel—to suit the topic. Ask the user before implementation if extra space or an unusual layout ratio is needed.
3. **Notation and rendering**:
   - Use LaTeX for formal equations and physics notation, preferably rendered with KaTeX.
4. **Physics and validation**:
   - All animations, numerical values, and charts must derive from the same simulation state.
   - Before delivery, run the **smallest runnable check** for the core calculations.
5. **Browser acceptance-testing order**:
   - Test with the In-App Browser. Use Chrome or local Headless Chromium/Playwright only when explicitly permitted by the applicable higher-level instructions or the user.
   - Bind temporary servers to `127.0.0.1` only and stop them immediately after testing. If no interactive testing tool is available, report: "Visual acceptance testing incomplete."
6. **Main-page integration**:
   - Before delivery, add every new simulator to the end of the `simulations` array in the root `simulations.js` file so it also appears as the latest simulator.
   - Each entry must provide `title`, `description`, `topic`, `href`, `image`, and `tags`. Add a new topic to the `topics` array when needed.
   - Store the simulator in its own root-level directory with an `index.html` entry point and a `preview.png` image.
   - Verify that the catalogue card, latest-simulator card, search, topic filter, preview image, and simulator link all work before delivery.
