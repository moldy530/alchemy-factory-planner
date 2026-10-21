import { describe, expect, test } from "bun:test";
import type { Edge } from "@xyflow/react";
import { applyEdgeLayouts, CONNECTION_SIDES, EdgeLayouts, insertRoutePoint, roundedRoutePath, routeMidpoint, routeThroughPoints, sideFromHandle } from "./edge-routing";

const edge: Edge = { id: "coal___coke", source: "coal", target: "coke", type: "belt", data: { rate: 10, strokes: 2 }, label: "10/m" };

describe("Saved connection layouts", () => {
    test("reattaches to box sides without changing the production connection or rates", () => {
        const [routed] = applyEdgeLayouts([edge], { [edge.id]: { sourceSide: "bottom", targetSide: "top", waypoints: [{ x: 20, y: 80 }] } });
        expect(routed.sourceHandle).toBe("source-bottom");
        expect(routed.targetHandle).toBe("target-top");
        expect(routed.source).toBe(edge.source);
        expect(routed.target).toBe(edge.target);
        expect(routed.label).toBe("10/m");
        expect(routed.data?.rate).toBe(10);
        expect(routed.data?.strokes).toBe(2);
        expect(edge.sourceHandle).toBeUndefined();
    });
    test("route survives serialization and production recalculation", () => {
        const layouts: EdgeLayouts = { [edge.id]: { sourceSide: "left", waypoints: [{ x: -50, y: 40 }] } };
        const restored = JSON.parse(JSON.stringify(layouts));
        const [routed] = applyEdgeLayouts([{ ...edge, data: { rate: 30 } }], restored);
        expect(routed.sourceHandle).toBe("source-left");
        expect(routed.data?.routePoints).toEqual(layouts[edge.id].waypoints);
        expect(routed.data?.rate).toBe(30);
    });
    test("reset clears old custom sides and bends without changing other edges", () => {
        const customized = applyEdgeLayouts([edge], { [edge.id]: { sourceSide: "top", waypoints: [{ x: 1, y: 2 }] } });
        const [reset] = applyEdgeLayouts(customized, {});
        expect(reset.sourceHandle).toBeNull();
        expect(reset.targetHandle).toBeNull();
        expect(reset.data?.routePoints).toBeUndefined();
        const other = { ...edge, id: "other" };
        expect(applyEdgeLayouts([other], { [edge.id]: { sourceSide: "left" } })[0].sourceHandle).toBeNull();
    });
    test("legacy handles have their original defaults", () => {
        expect(sideFromHandle(undefined, "right")).toBe("right");
        expect(sideFromHandle(null, "left")).toBe("left");
        expect(sideFromHandle("source-top", "right")).toBe("top");
        expect(sideFromHandle("invalid", "left")).toBe("left");
    });
});

describe("Manual connection paths", () => {
    for (const sourceSide of CONNECTION_SIDES) for (const targetSide of CONNECTION_SIDES) {
        test(`${sourceSide} to ${targetSide} stays orthogonal and passes through every bend`, () => {
            const source = { x: 0, y: 0 }, target = { x: 300, y: 150 };
            const bends = [{ x: 70, y: -100 }, { x: 200, y: 250 }];
            const points = routeThroughPoints(source, target, sourceSide, targetSide, bends);
            expect(points[0]).toEqual(source);
            expect(points[points.length - 1]).toEqual(target);
            for (const bend of bends) expect(points).toContainEqual(bend);
            for (let i = 1; i < points.length; i++) expect(points[i].x === points[i - 1].x || points[i].y === points[i - 1].y).toBe(true);
            expect(roundedRoutePath(points)).not.toContain("NaN");
            expect(roundedRoutePath(points)).not.toContain("Infinity");
        });
    }
    test("labels follow distance along the routed path", () => {
        expect(routeMidpoint([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 300 }])).toEqual({ x: 100, y: 100 });
    });
    test("one pivot can lie on a straight run without adding a stair-step near the destination", () => {
        const bounds = { left: 300, right: 550, top: 0, bottom: 200 };
        const points = routeThroughPoints({ x: 0, y: 400 }, { x: 300, y: 100 }, "right", "left", [{ x: 150, y: 250 }], bounds);
        expect(points).toContainEqual({ x: 150, y: 100 });
        expect(points).not.toContainEqual({ x: 276, y: 250 });
        expect(points).not.toContainEqual({ x: 150, y: 224 });
    });
    test("moving a single pivot vertically along that run does not change the drawn route", () => {
        const bounds = { left: 300, right: 550, top: 0, bottom: 200 };
        const route = (y: number) => roundedRoutePath(routeThroughPoints({ x: 0, y: 400 }, { x: 300, y: 100 }, "right", "left", [{ x: 150, y }], bounds));
        expect(route(250)).toBe(route(300));
    });
    test("a bend below both boxes is routed without doubling back over itself", () => {
        const bend = { x: 150, y: 300 };
        const points = routeThroughPoints({ x: 0, y: 50 }, { x: 300, y: 0 }, "bottom", "top", [bend]);
        const index = points.findIndex(point => point.x === bend.x && point.y === bend.y);
        expect(points[index - 1].x).toBe(bend.x);
        expect(points[index + 1].y).toBe(bend.y);
        expect(points[index + 1].x).not.toBe(bend.x);
    });
    test("adding another bend preserves route order", () => {
        expect(insertRoutePoint({ x: 0, y: 0 }, { x: 300, y: 0 }, [{ x: 100, y: 0 }, { x: 200, y: 0 }], { x: 150, y: 10 }))
            .toEqual([{ x: 100, y: 0 }, { x: 150, y: 10 }, { x: 200, y: 0 }]);
    });
    test("the final approach stays outside the destination box", () => {
        const bounds = { left: 250, right: 500, top: 0, bottom: 100 };
        const points = routeThroughPoints({ x: 0, y: 0 }, { x: 375, y: 0 }, "bottom", "top", [{ x: 200, y: 200 }], bounds);
        const index = points.findIndex(point => point.x === 200 && point.y === 200);
        expect(points[index + 1].x).toBeLessThan(bounds.left);
        expect(points[index + 2].y).toBeLessThan(bounds.top);
    });
    test("coincident points do not generate invalid paths", () => {
        const points = routeThroughPoints({ x: 0, y: 0 }, { x: 0, y: 0 }, "right", "left", [{ x: 24, y: 0 }]);
        expect(roundedRoutePath(points)).not.toContain("NaN");
        expect(routeMidpoint([])).toEqual({ x: 0, y: 0 });
    });
});
