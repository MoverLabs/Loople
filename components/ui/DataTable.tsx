import React from "react";
import { EmptyState } from "./EmptyState";

export type Column<T> = {
	header: string;
	render: (row: T) => React.ReactNode;
	className?: string;
};

export function DataTable<T>({
	rows,
	columns,
	empty,
}: {
	rows: T[];
	columns: Column<T>[];
	empty?: { title?: string; description?: string; ctaHref?: string; ctaLabel?: string };
}) {
	if (!rows.length) {
		return <EmptyState {...(empty ?? {})} />;
	}
	return (
		<div className="w-full overflow-x-auto">
			<table className="w-full caption-bottom text-sm">
				<thead className="[&_th]:px-3 [&_th]:py-2">
					<tr>
						{columns.map((c) => (
							<th key={c.header} className="text-left font-medium text-muted-foreground">
								{c.header}
							</th>
						))}
					</tr>
				</thead>
				<tbody className="[&_td]:px-3 [&_td]:py-2">
					{rows.map((row, idx) => (
						<tr key={idx} className="border-t">
							{columns.map((c, i) => (
								<td key={i} className={c.className}>
									{c.render(row)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
} 