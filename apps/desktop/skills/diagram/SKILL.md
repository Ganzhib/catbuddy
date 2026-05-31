---
name: diagram
description: Analyze workspace code and generate architecture diagrams (Draw.io XML).
---

# Architecture Diagram

When the user's message starts with `[架构图模式]`, or when they ask you to draw, generate, or create an architecture diagram, system diagram, data flow diagram, deployment diagram, module relationship diagram, or similar technical diagram, follow these instructions.

## When To Use

- System architecture: show components, their interactions, and data flow.
- Microservices: show service boundaries, APIs, and inter-service communication.
- Data flow: show how data moves through the system.
- Deployment: show servers, containers, load balancers, and network topology.
- Module/class relationships: show key entities and their dependencies.

## How It Works

1. **Use the same evidence sources as normal chat**:
   - Treat the current workspace as the primary source of truth.
   - If uploaded images or files are present in the user message, inspect and use their content as part of the diagram evidence.
   - Do not generate a generic diagram from the prompt alone when workspace or uploaded-file evidence is available.
2. **Read workspace files first**: Use `list_dir`, `grep`, and `read_file` tools to analyze the project structure and source code before drawing.
3. **Prioritize relevant evidence**: Identify entry points, package manifests, routing/session/service files, API boundaries, storage layers, and any files explicitly referenced by the user.
4. **Analyze the architecture**: Identify the main components, their relationships, data flows, and deployment/runtime structure.
5. **Generate and display Draw.io XML**: Prefer the `display_diagram` tool to save the `.drawio` file and open it in the UI editor automatically. Never call `display_diagram` with empty `{}` arguments; only call it after you have complete non-empty Draw.io XML in the `xml` parameter. Use `append_diagram` to add large follow-up chunks of complete `mxCell` elements to an existing diagram. Use `edit_diagram` for targeted changes to an existing `.drawio` file. Use `write_file` only as a fallback when diagram tools are unavailable.

If uploaded files contain source code, configuration, logs, API descriptions, or diagrams, base the generated diagram on those contents together with the workspace analysis. If an uploaded image is relevant, extract visible architecture cues from it and incorporate them.

## Tool Calling Rules

- Do not call `display_diagram`, `append_diagram`, or `edit_diagram` with empty `{}` arguments.
- If the XML is not ready yet, continue reasoning or inspect files first; do not call a diagram tool as a placeholder.
- `display_diagram.xml` must be actual Draw.io XML starting with `<mxfile>`, `<mxGraphModel>`, or `<mxCell>`; never pass Markdown, ASCII diagrams, Mermaid, PlantUML, or plain text.
- `append_diagram.xml` must contain one or more complete `mxCell` elements.
- `edit_diagram.operations` must be a non-empty array.
- If a diagram tool returns a recoverable argument error, do not finalize the answer. Generate the missing XML/arguments and retry the correct diagram tool in the next step.

## Large Diagram Chunks

For large diagrams, first call `display_diagram` with a valid base `.drawio` document containing root cells and the initial visible structure. Then call `append_diagram` with additional complete `mxCell` elements. Each appended cell must have a unique id and must not include root cells `id="0"` or `id="1"`.

## Editing Existing Diagrams

When the user asks to modify an existing diagram, prefer `edit_diagram` instead of regenerating the entire file. Use `read_file` first if you need to inspect current cell IDs.

`edit_diagram` operations:

- `update`: replace one existing `mxCell` by `cell_id`; provide complete `new_xml` with the same id.
- `add`: append a new complete `mxCell`; `cell_id` must not already exist.
- `delete`: remove a cell by id; referenced edges are removed as well.

Do not edit root cells `id="0"` or `id="1"`.

## Draw.io XML Rules

Generate valid Draw.io XML that can be opened directly in Draw.io.

```xml
<mxfile>
  <diagram name="架构图" id="arch-1">
    <mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <!-- mxCell elements go here, starting from id="2" -->
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

### Cell Rules

- All `mxCell` elements are siblings inside `<root>`, not nested.
- Each `mxCell` ID starts from "2" and increments uniquely.
- Top-level elements have `parent="1"`.
- Container children have `parent` set to the container's ID.
- Position all elements within x: 0–1100, y: 0–800.
- Start layout from x=40, y=40.
- Adjacent elements spaced 150–200px apart.

### Edge (Connection) Rules

- Must set `exitX`/`exitY`/`entryX`/`entryY` on edges.
- Bidirectional connections use opposite sides (A→B right-out left-in, B→A left-out right-in).
- Same-path edges must stagger (`exitY` use 0.3 and 0.7).
- Use waypoints (`<Array as="points">`) to route around obstacles.
- Add one waypoint per direction change, 20–30px apart.
- Use natural connection points, not corners.

### Common Styles

- **Rounded rectangle**: `rounded=1;whiteSpace=wrap;html=1;`
- **Container/group**: `rounded=1;dashed=1;fillColor=#f5f5f5;`
- **Ellipse (start/end)**: `ellipse;whiteSpace=wrap;html=1;`
- **Diamond (decision)**: `shape=diamond;whiteSpace=wrap;html=1;`
- **Edge**: `edgeStyle=orthogonalEdgeStyle;endArrow=classic;`

### Color Palette

- **Frontend**: `fillColor=#dae8fc;strokeColor=#6c8ebf;` (blue)
- **Backend/Service**: `fillColor=#d5e8d4;strokeColor=#82b366;` (green)
- **Data/Storage**: `fillColor=#ffe6cc;strokeColor=#d6b656;` (orange)
- **Infrastructure**: `fillColor=#e1d5e7;strokeColor=#9673a6;` (purple)
- **External**: `fillColor=#f8cecc;strokeColor=#b85450;` (red)

## Output Format

1. Analyze the workspace code and explain the architecture briefly.
2. Call `display_diagram` with valid Draw.io XML and an appropriate `.drawio` path so the diagram is saved and opened in the editor.
3. Tell the user the diagram has been created and can be edited in Draw.io.

If `display_diagram` is unavailable, write the `.drawio` file to the workspace using `write_file` and tell the user where it was created.

## Example

For a simple two-component architecture:

```xml
<mxfile>
  <diagram name="系统架构图" id="sys-arch">
    <mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="前端应用" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
          <mxGeometry x="40" y="40" width="160" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="3" value="后端服务" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1">
          <mxGeometry x="320" y="40" width="160" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="4" style="edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0.5;entryX=0;entryY=0.5;endArrow=classic;" edge="1" parent="1" source="2" target="3">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```
