import { ReactNode } from "react";
import { Panel, EmptyState } from "../dashboard/primitives";

export function DepositEmptyState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Panel className="py-10">
      <EmptyState title={title} description={description} action={action} />
    </Panel>
  );
}
