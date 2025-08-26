## Click Batching Logic
### The server keeps two counters in memory:
- persistedCount: the total saved in MongoDB.
- batchCount: the current batch accumulated in memory.

On each POST /click:
```
batchCount += 1
```
- The API responds with totalClicks = persistedCount + batchCount so the UI updates immediately.
```
  Flush condition (batch size = 1000):
  When batchCount reaches 1000, the server:
  Atomically increments the MongoDB counter by 1000 using $inc.
  Updates persistedCount += 1000.
  Resets batchCount = 0.
  The response for that 1000th click reflects the new persisted total.
```
- GET /clicks:
```
Returns { totalClicks: persistedCount + batchCount }.
```
- Concurrency guard:
 A flushInProgress flag ensures only one flush occurs when multiple clicks hit the 1000 boundary at the same time.

### Example flow:
```
Clicks 1–999:
batchCount: 1..999 (in memory only)
persistedCount: unchanged in DB
totalClicks = persistedCount + batchCount
Click 1000:
Writes +1000 to DB (atomic $inc)
persistedCount += 1000
batchCount resets to 0
totalClicks now equals the new persistedCount
Then the next 1000 clicks repeat the same cycle.
```
Note:

- To change the batch size, update the condition and DB increment in index.js:
- if (batchCount % 1000 === 0) -> switch to your desired threshold
```
{ $inc: { count: 1000 } } -> match the same threshold value
```
