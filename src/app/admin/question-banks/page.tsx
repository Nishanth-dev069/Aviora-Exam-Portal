import { Suspense } from 'react';
import QuestionBankList from '@/components/admin/QuestionBankList';
import QuestionBanksLoading from './loading';

export default function QuestionBanksPage() {
  return (
    <Suspense fallback={<QuestionBanksLoading />}>
      <QuestionBankList />
    </Suspense>
  );
}
