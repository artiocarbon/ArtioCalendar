import logger from "@calcom/lib/logger";

const log = logger.getSubLogger({ prefix: ["BackgroundJobProcessor"] });

/**
 * Background job processor for heavy operations
 * Uses setImmediate for non-blocking execution
 */

export interface BackgroundJob<T = any> {
  id: string;
  type: string;
  data: T;
  priority: 'high' | 'medium' | 'low';
  attempts: number;
  maxAttempts: number;
  delay: number;
  createdAt: Date;
  scheduledAt?: Date;
}

export interface JobHandler<T = any> {
  type: string;
  handler: (job: BackgroundJob<T>) => Promise<void>;
  onError?: (error: Error, job: BackgroundJob<T>) => void;
  onSuccess?: (job: BackgroundJob<T>) => void;
}

export class BackgroundJobProcessor {
  private static instance: BackgroundJobProcessor;
  private handlers = new Map<string, JobHandler>();
  private queue: BackgroundJob[] = [];
  private processing = new Set<string>();
  private isProcessing = false;

  private constructor() {
    // Start processing loop
    this.startProcessingLoop();
  }

  static getInstance(): BackgroundJobProcessor {
    if (!BackgroundJobProcessor.instance) {
      BackgroundJobProcessor.instance = new BackgroundJobProcessor();
    }
    return BackgroundJobProcessor.instance;
  }

  /**
   * Register a job handler
   */
  registerHandler<T>(handler: JobHandler<T>): void {
    this.handlers.set(handler.type, handler);
  }

  /**
   * Add a job to the queue
   */
  addJob<T>(job: Omit<BackgroundJob<T>, 'attempts' | 'createdAt'>): string {
    const fullJob: BackgroundJob<T> = {
      ...job,
      attempts: 0,
      createdAt: new Date(),
    };

    // Insert job based on priority
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const insertIndex = this.queue.findIndex(
      existingJob => priorityOrder[existingJob.priority] < priorityOrder[job.priority]
    );
    
    if (insertIndex === -1) {
      this.queue.push(fullJob);
    } else {
      this.queue.splice(insertIndex, 0, fullJob);
    }

    log.info(`Job added to queue: ${fullJob.id} (${fullJob.type})`);
    this.triggerProcessing();
    
    return fullJob.id;
  }

  /**
   * Schedule a job for future execution
   */
  scheduleJob<T>(
    type: string,
    data: T,
    delay: number,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): string {
    return this.addJob({
      id: this.generateJobId(),
      type,
      data,
      priority,
      maxAttempts: 3,
      delay,
      scheduledAt: new Date(Date.now() + delay),
    });
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    total: number;
    processing: number;
    byPriority: Record<string, number>;
    byType: Record<string, number>;
  } {
    const byPriority = this.queue.reduce((acc, job) => {
      acc[job.priority] = (acc[job.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byType = this.queue.reduce((acc, job) => {
      acc[job.type] = (acc[job.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: this.queue.length,
      processing: this.processing.size,
      byPriority,
      byType,
    };
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private triggerProcessing(): void {
    if (!this.isProcessing) {
      setImmediate(() => this.processQueue());
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      while (this.queue.length > 0) {
        const job = this.queue[0];
        
        // Check if job is scheduled for future
        if (job.scheduledAt && job.scheduledAt > new Date()) {
          break;
        }

        // Remove job from queue
        this.queue.shift();
        
        // Check if already processing
        if (this.processing.has(job.id)) {
          continue;
        }

        // Process job
        setImmediate(() => this.processJob(job));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processJob(job: BackgroundJob): Promise<void> {
    this.processing.add(job.id);
    
    try {
      const handler = this.handlers.get(job.type);
      if (!handler) {
        log.error(`No handler found for job type: ${job.type}`);
        return;
      }

      log.info(`Processing job: ${job.id} (${job.type})`);
      await handler.handler(job);
      
      handler.onSuccess?.(job);
      log.info(`Job completed successfully: ${job.id}`);
      
    } catch (error) {
      log.error(`Job failed: ${job.id}`, error);
      
      const handler = this.handlers.get(job.type);
      handler?.onError?.(error as Error, job);
      
      // Retry logic
      if (job.attempts < job.maxAttempts) {
        job.attempts++;
        job.delay = Math.min(job.delay * 2, 60000); // Exponential backoff, max 1 minute
        
        log.info(`Retrying job: ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);
        
        // Re-add job to queue with delay
        setTimeout(() => {
          this.queue.push(job);
          this.triggerProcessing();
        }, job.delay);
      } else {
        log.error(`Job failed permanently: ${job.id} after ${job.maxAttempts} attempts`);
      }
    } finally {
      this.processing.delete(job.id);
      this.triggerProcessing();
    }
  }

  private startProcessingLoop(): void {
    // Process queue every 5 seconds to catch any scheduled jobs
    setInterval(() => {
      this.triggerProcessing();
    }, 5000);
  }
}

// Singleton instance
export const backgroundJobProcessor = BackgroundJobProcessor.getInstance();

/**
 * Common job handlers
 */

export const EmailJobHandler: JobHandler<{
  to: string[];
  subject: string;
  template: string;
  data?: any;
}> = {
  type: 'email',
  handler: async (job) => {
    // Import email service dynamically to avoid circular dependencies
    const { sendEmail } = await import("@calcom/emails/email-manager");
    
    for (const recipient of job.data.to) {
      await sendEmail({
        to: recipient,
        subject: job.data.subject,
        template: job.data.template,
        data: job.data.data,
      });
    }
  },
  onError: (error, job) => {
    log.error(`Email job failed: ${job.id}`, error);
  },
  onSuccess: (job) => {
    log.info(`Email job completed: ${job.id}`);
  },
};

export const WebhookJobHandler: JobHandler<{
  url: string;
  payload: any;
  headers?: Record<string, string>;
}> = {
  type: 'webhook',
  handler: async (job) => {
    const response = await fetch(job.data.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...job.data.headers,
      },
      body: JSON.stringify(job.data.payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status: ${response.status}`);
    }
  },
  onError: (error, job) => {
    log.error(`Webhook job failed: ${job.id}`, error);
  },
};

export const AnalyticsJobHandler: JobHandler<{
  event: string;
  properties?: Record<string, any>;
  userId?: number;
}> = {
  type: 'analytics',
  handler: async (job) => {
    // Track analytics event
    // This would integrate with your analytics service
    log.info(`Analytics event: ${job.data.event}`, job.data.properties);
  },
};

// Register default handlers
backgroundJobProcessor.registerHandler(EmailJobHandler);
backgroundJobProcessor.registerHandler(WebhookJobHandler);
backgroundJobProcessor.registerHandler(AnalyticsJobHandler);

/**
 * Utility functions for common background operations
 */

export const BackgroundJobs = {
  /**
   * Send email in background
   */
  sendEmail: (
    to: string[],
    subject: string,
    template: string,
    data?: any,
    delay: number = 0
  ) => {
    return backgroundJobProcessor.scheduleJob('email', {
      to,
      subject,
      template,
      data,
    }, delay, 'medium');
  },

  /**
   * Send webhook in background
   */
  sendWebhook: (
    url: string,
    payload: any,
    headers?: Record<string, string>,
    delay: number = 0
  ) => {
    return backgroundJobProcessor.scheduleJob('webhook', {
      url,
      payload,
      headers,
    }, delay, 'low');
  },

  /**
   * Track analytics event in background
   */
  trackEvent: (
    event: string,
    properties?: Record<string, any>,
    userId?: number,
    delay: number = 0
  ) => {
    return backgroundJobProcessor.scheduleJob('analytics', {
      event,
      properties,
      userId,
    }, delay, 'low');
  },
};
