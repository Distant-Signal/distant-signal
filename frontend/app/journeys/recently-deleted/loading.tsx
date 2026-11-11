import { PageSkeleton, SkeletonPageHeader, SkeletonRows, SkeletonSection } from '@/components/PageSkeleton';

/** The Recently deleted page's skeleton: its heading, the intro and the
 * list, as rows. */
export default function RecentlyDeletedLoading() {
  return (
    <PageSkeleton label="Loading recently deleted journeys" maw={640}>
      <SkeletonPageHeader width="45%" />
      <SkeletonSection gap="xs">
        <SkeletonRows count={3} />
      </SkeletonSection>
    </PageSkeleton>
  );
}
