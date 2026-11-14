import { processChartData } from './merbench';
import type { FilteredData } from './merbench-types';

export interface ChartTable {
  headings: string[];
  rows: string[][];
}

// Server-rendered alternatives and filter updates use the plots' own processors.
export function getChartTables(data: FilteredData): Record<string, ChartTable> {
  const difficulty = processChartData.testGroup(data.testGroupsData);
  const tokens = processChartData.tokens(data.rawData);
  const failures = processChartData.failureAnalysis(data.failureAnalysisData);
  const number = (value: number) =>
    value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
  return {
    'test-group-chart': {
      headings: [
        'Model',
        ...difficulty.traces.map((trace) => `${trace.name} success rate`),
      ],
      rows: difficulty.models.map((model, index) => [
        model,
        ...difficulty.traces.map((trace) => `${number(trace.y[index])}%`),
      ]),
    },
    'token-chart': {
      headings: ['Model', 'Average request tokens', 'Average response tokens'],
      rows: tokens.sortedIndices.map((index) => [
        tokens.models[index],
        number(tokens.avgRequestTokens[index]),
        number(tokens.avgResponseTokens[index]),
      ]),
    },
    'failure-analysis-chart': {
      headings: [
        'Model',
        'Invalid Diagram',
        'MCP Tool Failure',
        'Usage Limit Exceeded',
      ],
      rows:
        failures?.models.map((model, index) => [
          model,
          ...failures.traces.map((trace) => String(trace.y[index])),
        ]) ?? [],
    },
  };
}

export function updateChartTables(data: FilteredData): void {
  for (const [id, table] of Object.entries(getChartTables(data))) {
    const element = document.getElementById(`${id}-data`);
    if (!element) continue;
    const header = document.createElement('tr');
    for (const label of table.headings) {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = label;
      header.append(cell);
    }
    element.querySelector('thead')?.replaceChildren(header);
    const rows = table.rows.map((values) => {
      const row = document.createElement('tr');
      values.forEach((value, index) => {
        const cell = document.createElement(index === 0 ? 'th' : 'td');
        if (cell instanceof HTMLTableCellElement && index === 0)
          cell.scope = 'row';
        cell.textContent = value;
        row.append(cell);
      });
      return row;
    });
    if (!rows.length) {
      const row = document.createElement('tr');
      const cell = row.insertCell();
      cell.colSpan = table.headings.length;
      cell.textContent = 'No matching runs. Adjust the filters above.';
      rows.push(row);
    }
    element.querySelector('tbody')?.replaceChildren(...rows);
  }
}
