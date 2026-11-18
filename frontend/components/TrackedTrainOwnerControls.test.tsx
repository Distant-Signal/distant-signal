import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithMantine } from '@/test/render';
import { loneTrain } from '@/test/journeyFixtures';
import { testPublicId, testTrackingId } from '@/test/apiDefaults';
import { ID_SHAPES } from '@/test/zeroNumericIds';
import { TrackedTrainOwnerControls } from './TrackedTrainOwnerControls';

interface DeleteProps {
  inJourney?: boolean;
  deletesJourney?: boolean;
  trackingId?: string;
}

const deleteProps = vi.hoisted(() => ({ latest: null as null | DeleteProps }));

vi.mock('./DeleteTrainButton', () => ({
  DeleteTrainButton: (props: DeleteProps) => {
    deleteProps.latest = props;
    return null;
  },
}));
vi.mock('./RenameTrainButton', () => ({ RenameTrainButton: () => null }));
vi.mock('./AddToGroupButton', () => ({ AddToGroupButton: () => null }));

describe.each(ID_SHAPES)('TrackedTrainOwnerControls (%s)', (_name, shape) => {
  const render = (overrides: Parameters<typeof loneTrain>[1]) => {
    renderWithMantine(<TrackedTrainOwnerControls train={shape(loneTrain(5, overrides))} />);
    return deleteProps.latest;
  };

  it('is in a journey when a bigger journey than its own one-leg one has it', () => {
    const props = render({ journeyIds: [1, 2], singleLegJourneyIds: [1] });
    expect(props?.inJourney).toBe(true);
    expect(props?.deletesJourney).toBe(true);
    expect(props?.trackingId).toBe(testTrackingId(5));
    expect(screen.getByRole('link', { name: 'Open journey' })).toHaveAttribute('href', `/journeys/${testPublicId(1)}`);
  });

  it('is in no journey when its own one-leg journey is the only one', () => {
    const props = render({ journeyIds: [1], singleLegJourneyIds: [1] });
    expect(props?.inJourney).toBe(false);
    expect(props?.deletesJourney).toBe(true);
  });

  it('is in a journey for any journey when the api sent no one-leg list', () => {
    const train = loneTrain(5, { journeyIds: [3] });
    const { singleLegJourneyIds: _ids, singleLegJourneyPublicIds: _publicIds, ...withoutOwn } = train;
    renderWithMantine(<TrackedTrainOwnerControls train={shape(withoutOwn)} />);
    expect(deleteProps.latest?.inJourney).toBe(true);
    expect(deleteProps.latest?.deletesJourney).toBe(false);
  });
});
