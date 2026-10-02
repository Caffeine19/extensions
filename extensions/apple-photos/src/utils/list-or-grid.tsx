import { Grid, List } from "@raycast/api";

/**
 * `ListOrGrid` is not part of the official `@raycast/api` — it's the local wrapper
 * pattern shared across several extensions in the raycast/extensions monorepo
 * (e.g. `visual-studio-code-recent-projects`, `cursor-recent-projects`, see
 * `src/lib/grid-or-list.ts` there).
 *
 * Unlike the monorepo version, which reads a static `layout` preference, these
 * wrappers take `layoutType` as a prop so the layout can be switched at runtime.
 *
 * Props are the intersection of the `List` and `Grid` variants: pass the union of
 * both layouts' props and the inactive ones are ignored at runtime.
 */

export type ListType = "list";
export type GridType = "grid";
export type LayoutType = ListType | GridType;

type ListOrGridProps = List.Props & Grid.Props & { layoutType: LayoutType };

export function ListOrGrid({ layoutType, ...props }: ListOrGridProps) {
  return layoutType === "list" ? <List {...(props as List.Props)} /> : <Grid {...(props as Grid.Props)} />;
}

type ListOrGridItemProps = List.Item.Props & Grid.Item.Props & { layoutType: LayoutType };

export function ListOrGridItem({ layoutType, ...props }: ListOrGridItemProps) {
  return layoutType === "list" ? (
    <List.Item {...(props as List.Item.Props)} />
  ) : (
    <Grid.Item {...(props as Grid.Item.Props)} />
  );
}

type ListOrGridEmptyViewProps = List.EmptyView.Props & Grid.EmptyView.Props & { layoutType: LayoutType };

export function ListOrGridEmptyView({ layoutType, ...props }: ListOrGridEmptyViewProps) {
  return layoutType === "list" ? (
    <List.EmptyView {...(props as List.EmptyView.Props)} />
  ) : (
    <Grid.EmptyView {...(props as Grid.EmptyView.Props)} />
  );
}
