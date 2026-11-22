import { describe, it, expect, vi, beforeEach } from 'vitest';
import SharedJourneyTrainPage, { generateMetadata, dynamic } from './page';
import * as trainPage from '@/app/train/[uid]/[date]/page';

vi.mock('@/app/train/[uid]/[date]/page', () => ({
  renderTrainPage: vi.fn(async () => 'rendered'),
  PRIVATE_TRAIN_DESCRIPTION: 'A train from a journey.',
}));
const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound: () => notFoundMock() }));

const params = (token: string, uid = 'W12345', date = '2026-08-31') => Promise.resolve({ token, uid, date });

describe('/journeys/shared/[token]/train/[uid]/[date]', () => {
  beforeEach(() => {
    notFoundMock.mockClear();
    vi.mocked(trainPage.renderTrainPage).mockClear();
  });

  it('renders the train page with the share token from the path', async () => {
    await SharedJourneyTrainPage({ params: params('Abc_-123') });
    expect(trainPage.renderTrainPage).toHaveBeenCalledWith('W12345', '2026-08-31', 'Abc_-123');
  });

  it('404s a malformed token or date without any fetch', async () => {
    await expect(SharedJourneyTrainPage({ params: params('a b') })).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(SharedJourneyTrainPage({ params: params('Abc', 'W12345', 'x') })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(trainPage.renderTrainPage).not.toHaveBeenCalled();
  });

  it('has generic, never-indexed metadata and never fetches', async () => {
    const metadata = await generateMetadata({ params: params('Abc_-123') });
    expect(metadata.title).toBe('Train W12345');
    expect(metadata.description).toBe('A train from a journey.');
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(JSON.stringify(metadata)).not.toContain('Abc_-123');
    expect(JSON.stringify(metadata)).not.toContain('card.png');
  });

  it('is never prerendered or stored', () => {
    expect(dynamic).toBe('force-dynamic');
  });
});
