import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { container } from '../../../__tests__/test-composition-root';
import { Fixture } from '../../../__tests__/action-fixture';
import { TransitionPoints } from '../../features/transition';

const fixture = container.resolve(Fixture);
let transitionPoints: TransitionPoints | null = null;

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    fixture.testHelper.insertDummyValidator('steemmonsters', true, 100);
    fixture.testHelper.insertDummyVote('voter', 'steemmonsters', 100);
    fixture.testHelper.setStaked('voter', 50);
    await fixture.loader.load();
    transitionPoints = container.resolve(TransitionPoints);
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for transition_fix_vote_weight does not crash.', () => {
    return expect(fixture.opsHelper.processVirtualOp('transition_fix_vote_weight', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for transition_fix_vote_weight does not crash.', () => {
    return expect(fixture.opsHelper.processVirtualOp('transition_fix_vote_weight', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('transition_fix_vote_weight works on block num', async () => {
    await fixture.opsHelper.processVirtualOp(
        'transition_fix_vote_weight',
        '$TRANSITIONS',
        {
            block_num: transitionPoints!.transition_points.fix_vote_weight,
        },
        {
            block_num: transitionPoints!.transition_points.fix_vote_weight,
        },
    );

    const [voteWeight] = await fixture.testHelper.votesForValidator('steemmonsters');
    expect(voteWeight.vote_weight).toEqual(50);

    const validator = await fixture.testHelper.validator('steemmonsters');
    expect(validator).toBeTruthy();
    expect(validator!.total_votes).toEqual(50);
});
