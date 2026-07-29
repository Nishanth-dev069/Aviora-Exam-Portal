import ExamDetail from '@/components/admin/ExamDetail';

export default async function ExamDetailPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  return <ExamDetail examId={examId} />;
}
