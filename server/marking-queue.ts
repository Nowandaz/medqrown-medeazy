import { markSAQResponses } from "./ai-orchestrator";

interface QueueItem {
  examId: number;
  callbacks: Array<{ resolve: () => void; reject: (err: Error) => void }>;
}

const queue: QueueItem[] = [];
let processing = false;
const activeExamIds = new Set<number>();

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const item = queue.shift()!;
    activeExamIds.delete(item.examId);
    try {
      console.log(`[Marking Queue] Processing exam ${item.examId} (${queue.length} remaining in queue)`);
      await markSAQResponses(item.examId);
      item.callbacks.forEach(cb => cb.resolve());
    } catch (err: any) {
      console.error(`[Marking Queue] Error marking exam ${item.examId}:`, err.message);
      item.callbacks.forEach(cb => cb.reject(err as Error));
    }
  }

  processing = false;
}

export function enqueueMarking(examId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = queue.find(q => q.examId === examId);
    if (existing) {
      existing.callbacks.push({ resolve, reject });
      console.log(`[Marking Queue] Deduped exam ${examId} (${existing.callbacks.length} listeners)`);
      return;
    }

    queue.push({ examId, callbacks: [{ resolve, reject }] });
    console.log(`[Marking Queue] Enqueued exam ${examId} (queue size: ${queue.length})`);
    activeExamIds.add(examId);
    processQueue();
  });
}

export function getQueueStatus() {
  return {
    queueLength: queue.length,
    isProcessing: processing,
  };
}
