import emailDB from '@/lib/db/email';
import { runClassifyBatch } from '@/lib/email/classify';

async function runAutoDelete(env: CloudflareEnv): Promise<void> {

    if (env.ENABLE_AUTO_DEL === 'false') {
        console.log('Auto delete is disabled');
        return;
    }
    try {
        const delTypeStr = env.AUTO_DEL_TYPE || '';
        const delTime = parseInt(env.AUTO_DEL_TIME || '3600', 10);

        if (!delTypeStr || isNaN(delTime)) {
            console.error('Invalid AUTO_DEL_TYPE or AUTO_DEL_TIME configuration');
            return;
        }

        const delTypes = delTypeStr.split(',').map(t => t.trim()).filter(t => t);
        const expiredTime = Date.now() - (delTime * 1000);
        const expiredDate = new Date(expiredTime).toISOString();

        const deletedIds = await emailDB.deleteExpiredByType(env, delTypes, expiredDate);

        if (deletedIds.length === 0) {
            console.log('No expired emails found to delete');
            return;
        }

        console.log(`Successfully deleted ${deletedIds.length} expired emails`);
    } catch (error) {
        console.error('Error in scheduled handler:', error);
        throw error;
    }
}

export default async function scheduledHandler(
    controller: ScheduledController,
    env: CloudflareEnv,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ctx: ExecutionContext
): Promise<void> {
    // 分类队列消费：命中分类 cron 时走异步批量分类分支
    const classifyCron = (env.CLASSIFY_CRON || '').trim();
    if (classifyCron && controller.cron === classifyCron) {
        await runClassifyBatch(env);
        return;
    }

    await runAutoDelete(env);
}
