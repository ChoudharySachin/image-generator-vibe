# Reference Image Logic - Updated Strategy

## Goal
The system must decouple **Content/Elements** (what to draw) from **Style/Aesthetics** (how to draw it).
- **Reference Image**: Source of Truth for mathematical elements, diagrams, shapes, content.
- **User Settings**: Source of Truth for artistic style (e.g., Paper-craft, 3D) and orientation.

## Changes Implemented

### 1. Updated `promptBuilder.js`
Modified the simplified prompt instructions to explicitly separate concerns:

```
CRITICAL INSTRUCTION FOR REFERENCE IMAGES:
1. USE THE REFERENCE IMAGE FOR: The mathematical elements, diagrams, shapes, patterns, and content arrangements.
2. USE THE USER SELECTED STYLE FOR: The artistic look, rendering technique, materials, and overall aesthetic.
3. DO NOT copy the "style" of the reference image. Apply the "[SELECTED_STYLE]" style to the content shown in the reference.
```

### 2. Updated `api.js`
Replaced rigid "Exact Match" style rules with "Source of Truth" logic:

**Elements & Content (From Reference):**
- Extract specific math concepts, shapes, diagrams
- Maintain element arrangement and composition logic
- Ensure mathematical accuracy matches reference

**Artistic Style (From User Selection):**
- Apply the requested artistic style (e.g., Paper-craft) to the extracted elements
- **IGNORE** the artistic style of the reference image itself
- Transform reference content into target style

### 3. Removed Conflicting Instructions
Removed strict "same artist" and "same collection" instructions that were forcing the AI to copy the reference's rendering style.

## Expected Behavior

**Scenario: Black & White Reference + Paper-craft Style**
- **Input**: User attaches a B&W sketch of a triangle. Selects "Paper-craft" style.
- **Old Result**: A B&W sketch of a triangle (copied style).
- **New Result**: A textured, paper-cutout triangle (copied elements, new style).

**Scenario: Colorful Reference + Sketch Style**
- **Input**: User attaches a colorful glossy 3D chart. Selects "Chalk" style.
- **New Result**: A chalk drawing of that chart on a blackboard (copied elements, new style).
