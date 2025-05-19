import { LastBlockCache } from '@steem-monsters/splinterlands-validator';
import { Router } from 'express';
import { TransitionManager } from '../features/transition';

export function registerTransitionRoutes(app: Router) {
    app.get('/extensions/transitions', async (req, res, next) => {
        try {
            const lastBlockCache = req.resolver.resolve<LastBlockCache>(LastBlockCache);
            const TranisitionManager = req.resolver.resolve(TransitionManager);
            const blockNum = lastBlockCache.value?.block_num ?? 0;
            const statuses = TranisitionManager.getTransitionPointsStatusesAtBlock(blockNum);
            res.status(200).json({
                block_num: blockNum,
                transition_points: statuses,
            });
        } catch (err) {
            next(err);
        }
    });
}
