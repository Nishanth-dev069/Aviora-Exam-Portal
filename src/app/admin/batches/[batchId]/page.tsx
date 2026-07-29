import BatchDetails from '@/components/admin/BatchDetails';

export default async function BatchDetailsPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  return <BatchDetails batchId={batchId} />;
}
