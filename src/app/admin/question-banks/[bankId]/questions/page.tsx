import { createServerClient } from '@supabase/ssr';
import { notFound } from 'next/navigation';
import QuestionList from '@/components/admin/QuestionList';

export default async function BankQuestionsPage({ params }: { params: Promise<{ bankId: string }> }) {
  const { bankId } = await params;
  
  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } }
  );

  const { data: bank } = await supabaseAdmin
    .from('question_banks')
    .select('name, subject')
    .eq('id', bankId)
    .single();

  if (!bank) {
    notFound();
  }

  return (
    <QuestionList 
      bankId={bankId} 
      bankName={bank.name} 
      bankSubject={bank.subject} 
    />
  );
}
