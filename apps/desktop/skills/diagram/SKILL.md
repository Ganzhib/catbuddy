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
5. **For cloud/tech diagrams (AWS, Azure, GCP, K8s)**: Call `get_shape_library` FIRST to discover available icon shapes and their syntax before generating XML.
6. **Plan the layout before generating**: Briefly describe your layout strategy (2-3 sentences max) to avoid object overlapping or edges crossing objects, then use `display_diagram` to generate the XML.
7. **Generate and display Draw.io XML**: Never call `display_diagram` with empty `{}` arguments; only call it after you have complete non-empty Draw.io XML. Use `append_diagram` for large follow-up chunks. Use `edit_diagram` for targeted changes. Use `write_file` only as a fallback.

If uploaded files contain source code, configuration, logs, API descriptions, or diagrams, base the generated diagram on those contents together with the workspace analysis.

## Tool Calling Rules

- Do not call `display_diagram`, `append_diagram`, or `edit_diagram` with empty `{}` arguments.
- If the XML is not ready yet, continue reasoning or inspect files first; do not call a diagram tool as a placeholder.
- `display_diagram.xml` must be actual Draw.io XML starting with `<mxfile>`, `<mxGraphModel>`, or `<mxCell>`; never pass Markdown, ASCII diagrams, Mermaid, PlantUML, or plain text.
- `append_diagram.xml` must contain one or more complete `mxCell` elements.
- `edit_diagram.operations` must be a non-empty array.
- If a diagram tool returns a recoverable argument error, do not finalize the answer. Generate the missing XML/arguments and retry the correct diagram tool in the next step.
- After generating or editing a diagram, you don't need to describe it in detail. The user can see the diagram.

## Shape Libraries

For cloud architecture or technical diagrams, call `get_shape_library` to discover available icons:

- `aws4` — AWS services (EC2, S3, Lambda, RDS, DynamoDB, SQS, SNS, etc.)
- `kubernetes` — K8s resources (Pod, Deployment, Service, Ingress, etc.)
- `flowchart` — Standard flowchart shapes (process, decision, database, etc.)

Call `get_shape_library({ library: "aws4" })` BEFORE generating an AWS diagram to get the correct shape names and XML syntax.

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

### Layout Constraints

- **CRITICAL**: Keep all elements within a single page to avoid page breaks.
- Position all elements with x coordinates between 0-800 and y coordinates between 0-600.
- Maximum container width: 700px, maximum container height: 550px.
- Start positioning from reasonable margins (x=40, y=40).
- Space shapes 150-200px apart to create clear routing channels for edges.
- Use compact, efficient layouts; avoid spreading elements too far apart.
- For large diagrams, use vertical stacking or grid layouts that stay within bounds.
- Plan layout strategically: organize shapes into visual layers/zones (columns or rows) based on diagram flow.

### Cell Rules

- All `mxCell` elements are siblings inside `<root>`, never nested inside other mxCell elements.
- Each `mxCell` ID starts from "2" and increments uniquely.
- Top-level elements have `parent="1"`.
- Container children have `parent` set to the container's ID.
- Never include root cells `id="0"` or `id="1"` in your output.
- Escape special characters in values: `&lt;` for <, `&gt;` for >, `&amp;` for &, `&quot;` for ".

### Shape (vertex) Example

```xml
<mxCell id="2" value="Label" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
  <mxGeometry x="40" y="40" width="160" height="60" as="geometry"/>
</mxCell>
```

### Connector (edge) Example

```xml
<mxCell id="3" style="edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0.5;entryX=0;entryY=0.5;endArrow=classic;html=1;" edge="1" parent="1" source="2" target="4">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

## Edge Routing Rules — CRITICAL

You MUST follow these 7 rules to avoid overlapping lines and edge crossings:

### Rule 1: NEVER let multiple edges share the same path
If two edges connect the same pair of nodes, they MUST exit/enter at DIFFERENT positions.
Use `exitY=0.3` for first edge, `exitY=0.7` for second edge (never both 0.5).

### Rule 2: For bidirectional connections (A↔B), use OPPOSITE sides
- A→B: exit from RIGHT side of A (`exitX=1`), enter LEFT side of B (`entryX=0`)
- B→A: exit from LEFT side of B (`exitX=0`), enter RIGHT side of A (`entryX=1`)

### Rule 3: Always specify exitX, exitY, entryX, entryY explicitly
Every edge MUST have these 4 attributes set in the style.
Example: `style="edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0.3;entryX=0;entryY=0.3;endArrow=classic;html=1;"`

### Rule 4: Route edges AROUND intermediate shapes (obstacle avoidance)
- Before creating an edge, identify ALL shapes positioned between source and target.
- If any shape is in the direct path, you MUST use waypoints to route around it.
- For DIAGONAL connections: route along the PERIMETER of the diagram, not through the middle.
- Add 20-30px clearance from shape boundaries.
- NEVER draw a line that visually crosses over another shape's bounding box.

### Rule 5: Plan layout strategically BEFORE generating XML
- Organize shapes into visual layers/zones (columns or rows) based on diagram flow.
- Mentally trace each edge: "What shapes are between source and target?"
- Prefer layouts where edges naturally flow in one direction (left-to-right or top-to-bottom).

### Rule 6: Use multiple waypoints for complex routing
- One waypoint is often not enough — use 2-3 waypoints for L-shaped or U-shaped paths.
- Each direction change needs a waypoint (corner point).
- Waypoints should form clear horizontal/vertical segments (orthogonal routing).

### Rule 7: Choose NATURAL connection points based on flow direction
- NEVER use corner connections (e.g., `entryX=1,entryY=1`) — they look unnatural.
- For TOP-TO-BOTTOM flow: exit from bottom (`exitY=1`), enter from top (`entryY=0`).
- For LEFT-TO-RIGHT flow: exit from right (`exitX=1`), enter from left (`entryX=0`).
- For DIAGONAL connections: use the side closest to the target, not corners.

### Edge Waypoint Example (routing around obstacle)

When node A is at bottom-right and node B is at top-center, with obstacle in between:

```xml
<!-- Route around the RIGHT side of the diagram -->
<mxCell id="a_to_b" style="edgeStyle=orthogonalEdgeStyle;exitX=0.5;exitY=0;entryX=1;entryY=0.5;endArrow=classic;html=1;" edge="1" parent="1" source="a" target="b">
  <mxGeometry relative="1" as="geometry">
    <Array as="points">
      <mxPoint x="750" y="80"/>
      <mxPoint x="750" y="150"/>
    </Array>
  </mxGeometry>
</mxCell>
```

### Edge with Single Waypoint

```xml
<mxCell id="edge1" style="edgeStyle=orthogonalEdgeStyle;exitX=0.5;exitY=1;entryX=0.5;entryY=0;endArrow=classic;html=1;" edge="1" parent="1" source="a" target="b">
  <mxGeometry relative="1" as="geometry">
    <Array as="points">
      <mxPoint x="300" y="150"/>
    </Array>
  </mxGeometry>
</mxCell>
```

### Two edges between same nodes (CORRECT - no overlap)

```xml
<mxCell id="e1" style="edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0.3;entryX=0;entryY=0.3;endArrow=classic;html=1;" edge="1" parent="1" source="a" target="b">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
<mxCell id="e2" style="edgeStyle=orthogonalEdgeStyle;exitX=0;exitY=0.7;entryX=1;entryY=0.7;endArrow=classic;html=1;" edge="1" parent="1" source="b" target="a">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

## Pre-generation Verification Checklist

Before generating XML, mentally verify:
1. "Do any edges cross over shapes that aren't their source/target?" → If yes, add waypoints.
2. "Do any two edges share the same path?" → If yes, adjust exit/entry points.
3. "Are any connection points at corners (both X and Y are 0 or 1)?" → If yes, use edge centers instead.
4. "Could I rearrange shapes to reduce edge crossings?" → If yes, revise layout.

## Swimlane Example

```xml
<mxCell id="lane1" value="Frontend" style="swimlane;startSize=30;fillColor=#dae8fc;" vertex="1" parent="1">
  <mxGeometry x="40" y="40" width="200" height="300" as="geometry"/>
</mxCell>
<mxCell id="step1" value="Send Request" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="lane1">
  <mxGeometry x="20" y="60" width="160" height="40" as="geometry"/>
</mxCell>
<mxCell id="lane2" value="Backend" style="swimlane;startSize=30;fillColor=#d5e8d4;" vertex="1" parent="1">
  <mxGeometry x="280" y="40" width="200" height="300" as="geometry"/>
</mxCell>
<mxCell id="step2" value="Process" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="lane2">
  <mxGeometry x="20" y="60" width="160" height="40" as="geometry"/>
</mxCell>
<mxCell id="edge1" style="edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0.5;entryX=0;entryY=0.5;endArrow=classic;html=1;" edge="1" parent="1" source="step1" target="step2">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

Note: Edges are siblings to swimlanes (NOT nested inside them), connected via `source`/`target`.

## Grouping Example

```xml
<!-- Group container -->
<mxCell id="10" value="AWS Cloud" style="rounded=1;dashed=1;fillColor=#f5f5f5;strokeColor=#666666;" vertex="1" parent="1">
  <mxGeometry x="40" y="40" width="400" height="300" as="geometry"/>
</mxCell>
<!-- Elements inside the group (parent="10") -->
<mxCell id="11" value="EC2" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="10">
  <mxGeometry x="30" y="40" width="120" height="50" as="geometry"/>
</mxCell>
<mxCell id="12" value="RDS" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="10">
  <mxGeometry x="250" y="40" width="120" height="50" as="geometry"/>
</mxCell>
```

## Large Diagram Chunks

For large diagrams, first call `display_diagram` with a valid base `.drawio` document containing root cells and the initial visible structure. Then call `append_diagram` with additional complete `mxCell` elements. Each appended cell must have a unique id and must not include root cells `id="0"` or `id="1"`.

## Editing Existing Diagrams

When the user asks to modify an existing diagram, prefer `edit_diagram` instead of regenerating the entire file. Use `read_file` first if you need to inspect current cell IDs.

`edit_diagram` operations:

- `update`: replace one existing `mxCell` by `cell_id`; provide complete `new_xml` with the same id.
- `add`: append a new complete `mxCell`; `cell_id` must not already exist.
- `delete`: remove a cell by id; referenced edges are removed as well.

Do not edit root cells `id="0"` or `id="1"`.

## Common Styles

- **Rounded rectangle**: `rounded=1;whiteSpace=wrap;html=1;`
- **Container/group**: `rounded=1;dashed=1;fillColor=#f5f5f5;`
- **Ellipse (start/end)**: `ellipse;whiteSpace=wrap;html=1;`
- **Diamond (decision)**: `shape=diamond;whiteSpace=wrap;html=1;`
- **Cylinder (database)**: `shape=cylinder;whiteSpace=wrap;html=1;`
- **Cloud**: `shape=cloud`
- **Hexagon**: `shape=hexagon`
- **Document**: `shape=document`
- **Note/sticky**: `shape=note`
- **Parallelogram**: `shape=parallelogram`
- **Edge**: `edgeStyle=orthogonalEdgeStyle;endArrow=classic;html=1;`
- **Curved edge**: `curved=1;endArrow=classic;html=1;`
- **Swimlane**: `swimlane;startSize=30;`
- **Animated edge**: add `flowAnimation=1` to edge style

## Color Palette

- **Frontend**: `fillColor=#dae8fc;strokeColor=#6c8ebf;` (blue)
- **Backend/Service**: `fillColor=#d5e8d4;strokeColor=#82b366;` (green)
- **Data/Storage**: `fillColor=#ffe6cc;strokeColor=#d6b656;` (orange)
- **Infrastructure**: `fillColor=#e1d5e7;strokeColor=#9673a6;` (purple)
- **External/Third-party**: `fillColor=#f8cecc;strokeColor=#b85450;` (red)
- **API/Gateway**: `fillColor=#fff2cc;strokeColor=#d6b656;` (yellow)

## Output Format

1. Analyze the workspace code and explain the architecture briefly (2-3 sentences max).
2. Call `display_diagram` with valid Draw.io XML and an appropriate `.drawio` path.
3. Tell the user the diagram has been created and can be edited in Draw.io.

If `display_diagram` is unavailable, write the `.drawio` file to the workspace using `write_file` and tell the user where it was created.

## Full Example — Two-component Architecture

```xml
<mxfile>
  <diagram name="系统架构图" id="sys-arch">
    <mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="前端应用" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=13;" vertex="1" parent="1">
          <mxGeometry x="40" y="40" width="160" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="3" value="后端服务" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=13;" vertex="1" parent="1">
          <mxGeometry x="320" y="40" width="160" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="4" value="数据库" style="shape=cylinder;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d6b656;fontSize=13;" vertex="1" parent="1">
          <mxGeometry x="560" y="30" width="120" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="5" style="edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0.5;entryX=0;entryY=0.5;endArrow=classic;html=1;" edge="1" parent="1" source="2" target="3">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="6" style="edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0.5;entryX=0;entryY=0.5;endArrow=classic;html=1;" edge="1" parent="1" source="3" target="4">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```
