# Data Relationships Quick Reference

## Key Relationships

### Primary Keys and Groupings

1. **Model** - Primary identifier across all data sections
2. **test_group** - Secondary grouping (easy, medium, hard)
3. **provider** - Derived from Model name (Google, Amazon, etc.)

### Data Section Dependencies

```
raw_data (source)
    ↓
├── leaderboard (group by Model)
├── pareto_data (group by Model)
├── test_groups_data (group by Model + test_group)
├── failure_analysis_data (group by Model, count failures)
└── cost_breakdown_data (group by Model + test_group)
```

## Common Queries and Aggregations

### 1. Get Model Performance Summary

```javascript
// From raw_data
const modelSummary = rawData
  .filter((r) => r.Model === 'gemini-2.5-pro')
  .reduce(
    (acc, r) => ({
      successRate: acc.successRate + r.Score_MermaidDiagramValid,
      totalCost: acc.totalCost + r.total_cost,
      count: acc.count + 1,
    }),
    { successRate: 0, totalCost: 0, count: 0 }
  );

modelSummary.avgSuccessRate = (modelSummary.successRate / modelSummary.count) * 100;
```

### 2. Filter by Multiple Conditions

```javascript
// Get Amazon models on hard tests that succeeded
const filtered = rawData.filter(
  (r) => r.provider === 'Amazon' && r.test_group === 'hard' && r.Score_MermaidDiagramValid === 1
);
```

### 3. Calculate Cost Breakdown by Test Group

```javascript
// Group costs by difficulty
const costByDifficulty = {};
['easy', 'medium', 'hard'].forEach((group) => {
  const groupData = rawData.filter((r) => r.test_group === group);
  costByDifficulty[group] = {
    avgCost: groupData.reduce((sum, r) => sum + r.total_cost, 0) / groupData.length,
    totalCost: groupData.reduce((sum, r) => sum + r.total_cost, 0),
  };
});
```

## Pre-Aggregated vs. Raw Data Usage

### Use Pre-Aggregated Data When:

- Displaying initial unfiltered views
- Performance is critical
- Standard aggregations are sufficient

### Recalculate from Raw Data When:

- Filters are applied
- Custom aggregations needed
- Combining multiple filter conditions

## Filter Application Order

1. **Start with raw_data**
2. **Apply filters** (Model AND Provider AND TestGroup)
3. **Recalculate aggregations**
4. **Update visualizations**

## Cost Calculation Rules

- **Normal tests**: Cost = (input_tokens/1M × input_price) + (output_tokens/1M × output_price)
- **Failed tests** (Score_UsageLimitNotExceeded = 0): Cost = $0
- **Tiered pricing**: Price depends on total token count

## Data Validation Checks

```javascript
// Ensure data consistency
function validateData(jsonData) {
  // Check if model counts match
  const rawModels = new Set(jsonData.raw_data.map((r) => r.Model));
  const leaderboardModels = new Set(jsonData.leaderboard.map((l) => l.Model));

  console.assert(
    rawModels.size === leaderboardModels.size,
    'Model count mismatch between raw and leaderboard'
  );

  // Verify cost calculations
  jsonData.raw_data.forEach((row) => {
    if (row.Score_UsageLimitNotExceeded === 0) {
      console.assert(row.total_cost === 0, `Failed test should have 0 cost: ${row.Model}`);
    }
  });
}
```

## Real-World Example: Filtering and Cost Calculation

### Example: bedrock:us.amazon.nova-premier-v1:0 filtered to "easy" tests

When a user selects only "easy" difficulty, here's the complete calculation process:

#### Step 1: Data Filtering

```javascript
// Filter raw_data to find all entries matching criteria
const filteredData = rawData.filter(
  (row) => row.Model === 'bedrock:us.amazon.nova-premier-v1:0' && row.test_group === 'easy'
);
// Result: 5 test runs
```

#### Step 2: Raw Data Values

```
Run 1: Failed (Score=0), Duration=141.17s, Cost=$0.205715
Run 2: Failed (Score=0), Duration=60.77s,  Cost=$0.033888
Run 3: Success (Score=1), Duration=81.52s,  Cost=$0.186658
Run 4: Failed (Score=0), Duration=52.79s,  Cost=$0.045433
Run 5: Failed (Score=0), Duration=22.95s,  Cost=$0.030315
```

#### Step 3: Aggregation

```javascript
const totals = {
  runs: 5,
  successCount: 1, // Only Run 3 succeeded
  totalDuration: 359.21,
  totalCost: 0.502008,
  totalInputCost: 0.357533,
  totalOutputCost: 0.144475,
};
```

#### Step 4: Calculate Averages for Leaderboard

```javascript
const leaderboardEntry = {
  Success_Rate: (1 / 5) * 100, // 20.0%
  Avg_Duration: 359.21 / 5, // 71.84 seconds
  Avg_Cost: 0.502008 / 5, // $0.1004
  Avg_Input_Cost: 0.357533 / 5, // $0.0715
  Avg_Output_Cost: 0.144475 / 5, // $0.0289
  Runs: 5,
};
```

This demonstrates how the visualization dynamically recalculates all metrics from raw data when filters are applied, ensuring accurate cost averages for the filtered subset.

## Performance Optimization Tips

1. **Cache Filter Results**

   ```javascript
   const filterCache = new Map();
   function getCachedFilter(filterKey, rawData, filters) {
     if (!filterCache.has(filterKey)) {
       filterCache.set(filterKey, applyFilters(rawData, filters));
     }
     return filterCache.get(filterKey);
   }
   ```

2. **Use Indexed Lookups**

   ```javascript
   // Pre-index by model for fast lookups
   const modelIndex = {};
   rawData.forEach((row) => {
     if (!modelIndex[row.Model]) modelIndex[row.Model] = [];
     modelIndex[row.Model].push(row);
   });
   ```

3. **Batch Updates**
   ```javascript
   // Update all visualizations at once
   function updateAllVisualizations(filteredData) {
     requestAnimationFrame(() => {
       updateLeaderboard(filteredData);
       updateParetoPlot(filteredData);
       updateCostBreakdown(filteredData);
       updateFailureAnalysis(filteredData);
     });
   }
   ```
