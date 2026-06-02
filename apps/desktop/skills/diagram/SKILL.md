---
name: diagram
description: Analyze workspace code and generate architecture diagrams (Draw.io XML).
---

# Architecture Diagram

When the user's message starts with `[架构图模式]`, or when they ask you to draw, generate, or create an architecture/system/data-flow/deployment diagram, follow these instructions. This skill only activates in diagram mode — normal chat is unaffected.

## How To Generate

1. **Analyze workspace first**: Use `read_file`, `list_dir`, `grep` to understand the code structure.
2. **For cloud diagrams (AWS/K8s)**: Call `get_shape_library({ library: "aws4" })` FIRST to get icon syntax.
3. **Plan layout briefly** (1-2 sentences), then generate XML.
4. **Generate ONLY bare `<mxCell>` elements** — NO wrapper tags. The system auto-wraps them into a valid `.drawio` file.

## XML Rules (CRITICAL)

**Generate ONLY `<mxCell>` elements. Do NOT include `<mxfile>`, `<mxGraphModel>`, `<root>`, or root cells (id="0", id="1").**

### Shape (vertex)
```xml
<mxCell id="2" value="Label" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
  <mxGeometry x="40" y="40" width="160" height="60" as="geometry"/>
</mxCell>
```

### Edge (connector)
```xml
<mxCell id="3" style="edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0.5;entryX=0;entryY=0.5;endArrow=classic;html=1;" edge="1" parent="1" source="2" target="4">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

### Core Rules
- IDs start from "2", unique and sequential.
- Top-level elements: `parent="1"`. Grouped children: `parent="<container-id>"`.
- All mxCell elements are siblings — never nest inside another mxCell.
- Escape: `&lt;` `&gt;` `&amp;` `&quot;`

## Layout Constraints

- All elements: x=0~800, y=0~600 (single page, no breaks).
- Start from x=40, y=40. Space shapes 150-200px apart.
- Container max: 700px wide, 550px tall.

## Edge Routing — 5 Rules

1. **Stagger parallel edges**: Use `exitY=0.3` / `exitY=0.7` on edges between same nodes.
2. **Bidirectional**: A→B exits RIGHT (`exitX=1`), B→A exits LEFT (`exitX=0`).
3. **Always set exitX/exitY/entryX/entryY** on every edge.
4. **Avoid obstacles with waypoints**: Route around shapes between source and target:
```xml
<mxCell id="e1" style="edgeStyle=orthogonalEdgeStyle;exitX=0.5;exitY=1;entryX=1;entryY=0.5;endArrow=classic;html=1;" edge="1" parent="1" source="a" target="b">
  <mxGeometry relative="1" as="geometry">
    <Array as="points">
      <mxPoint x="300" y="200"/>
      <mxPoint x="500" y="200"/>
    </Array>
  </mxGeometry>
</mxCell>
```
5. **Use natural connection points** (edge centers), never corners (no entryX=1,entryY=1).

## Shape Types

`rounded=1` rectangle · `ellipse` · `shape=diamond` · `shape=cylinder` · `shape=cloud` · `shape=hexagon` · `shape=document` · `shape=note` · `shape=parallelogram` · `swimlane;startSize=30;` (swimlane) · `shape=triangle`

## Color Palette

| Layer | Style |
|-------|-------|
| Frontend (blue) | `fillColor=#dae8fc;strokeColor=#6c8ebf;` |
| Backend (green) | `fillColor=#d5e8d4;strokeColor=#82b366;` |
| Data/Storage (orange) | `fillColor=#ffe6cc;strokeColor=#d6b656;` |
| Infrastructure (purple) | `fillColor=#e1d5e7;strokeColor=#9673a6;` |
| External (red) | `fillColor=#f8cecc;strokeColor=#b85450;` |

## Swimlane Example

```xml
<mxCell id="lane1" value="Frontend" style="swimlane;startSize=30;fillColor=#dae8fc;" vertex="1" parent="1">
  <mxGeometry x="40" y="40" width="200" height="300" as="geometry"/>
</mxCell>
<mxCell id="step1" value="Step 1" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="lane1">
  <mxGeometry x="20" y="60" width="160" height="40" as="geometry"/>
</mxCell>
<mxCell id="lane2" value="Backend" style="swimlane;startSize=30;fillColor=#d5e8d4;" vertex="1" parent="1">
  <mxGeometry x="280" y="40" width="200" height="300" as="geometry"/>
</mxCell>
<mxCell id="step2" value="Step 2" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="lane2">
  <mxGeometry x="20" y="60" width="160" height="40" as="geometry"/>
</mxCell>
<mxCell id="edge1" style="edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0.5;entryX=0;entryY=0.5;endArrow=classic;html=1;" edge="1" parent="1" source="step1" target="step2">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

Edges are siblings (NOT nested inside swimlanes). Connected via `source`/`target` attributes.

## Full Example — Three-tier Architecture

```xml
<mxCell id="2" value="前端" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
  <mxGeometry x="40" y="40" width="140" height="50" as="geometry"/>
</mxCell>
<mxCell id="3" value="后端API" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1">
  <mxGeometry x="300" y="40" width="140" height="50" as="geometry"/>
</mxCell>
<mxCell id="4" value="数据库" style="shape=cylinder;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d6b656;" vertex="1" parent="1">
  <mxGeometry x="540" y="25" width="120" height="80" as="geometry"/>
</mxCell>
<mxCell id="5" style="edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0.5;entryX=0;entryY=0.5;endArrow=classic;html=1;" edge="1" parent="1" source="2" target="3">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
<mxCell id="6" style="edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0.5;entryX=0;entryY=0.5;endArrow=classic;html=1;" edge="1" parent="1" source="3" target="4">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

## Output

1. Briefly describe architecture (1-2 sentences).
2. Call `display_diagram({ xml: "..." })` with bare mxCell elements.
3. Mention diagram is ready.

If truncated, use `append_diagram`. For edits, use `edit_diagram` with cell IDs.
