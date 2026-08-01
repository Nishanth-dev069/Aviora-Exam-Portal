/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { TrendingUp, Target, Award, BookOpen } from 'lucide-react';
import Link from 'next/link';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { 
    day: 'numeric', month: 'short', year: '2-digit' 
  });
}

function getScoreColor(pct: number): string {
  if (pct >= 70) return '#22c55e';   // green-500
  if (pct >= 50) return '#f59e0b';   // amber-500
  return '#ef4444';                   // red-500
}

function CustomBar(props: any) {
  const { x, y, width, height, value } = props;
  const fill = getScoreColor(value);
  return <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} />;
}

export default function StudentAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/student/analytics')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error.message);
        else setData(d);
      })
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mt-8 space-y-4 animate-pulse">
        <div className="h-4 w-32 rounded bg-surface-2" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-surface-2" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-surface-2" />
        <div className="h-48 rounded-xl bg-surface-2" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mt-8 rounded-xl border border-border bg-surface-2 p-6 text-center">
        <p className="text-sm text-text-secondary">
          {data?.summary?.totalExamsTaken === 0
            ? "Take your first exam to see your analytics here."
            : "Analytics unavailable. Please try refreshing."}
        </p>
      </div>
    );
  }

  // If no exams taken yet
  if (data.summary.totalExamsTaken === 0) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center bg-surface">
        <BookOpen className="mx-auto h-10 w-10 text-text-muted" />
        <p className="mt-3 text-base font-bold text-text-primary">No exams taken yet</p>
        <p className="mt-1 text-sm text-text-secondary">
          Your performance analytics will appear here after you complete your first exam.
        </p>
      </div>
    );
  }

  const { summary, trendData, subjectData, recentResults } = data;

  const statCards = [
    {
      label: 'Exams Taken',
      value: summary.totalExamsTaken,
      unit: '',
      icon: BookOpen,
      color: 'text-blue-600',
      bg: 'bg-blue-50/70 border-blue-200',
    },
    {
      label: 'Average Score',
      value: summary.avgPercentage,
      unit: '%',
      icon: Target,
      color: summary.avgPercentage >= 70 ? 'text-emerald-600' : summary.avgPercentage >= 50 ? 'text-amber-600' : 'text-red-600',
      bg: summary.avgPercentage >= 70 ? 'bg-emerald-50/70 border-emerald-200' : summary.avgPercentage >= 50 ? 'bg-amber-50/70 border-amber-200' : 'bg-red-50/70 border-red-200',
    },
    {
      label: 'Best Score',
      value: summary.highestScore,
      unit: '%',
      icon: Award,
      color: 'text-purple-600',
      bg: 'bg-purple-50/70 border-purple-200',
    },
    {
      label: 'Pass Rate',
      value: summary.passRate !== null ? summary.passRate : '—',
      unit: summary.passRate !== null ? '%' : '',
      icon: TrendingUp,
      color: 'text-teal-600',
      bg: 'bg-teal-50/70 border-teal-200',
      subtitle: 'Scheduled exams only',
    },
  ];

  // Custom tooltip for line chart
  const TrendTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-lg text-xs">
        <p className="font-bold text-text-primary truncate max-w-[160px]">{d.examTitle}</p>
        <p className="text-text-secondary">{d.subject}</p>
        <p className="mt-1 font-extrabold" style={{ color: getScoreColor(d.percentage) }}>
          {d.percentage}%
        </p>
        <p className="text-text-muted">{formatDate(d.date)}</p>
      </div>
    );
  };

  // Custom tooltip for bar chart
  const SubjectTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-lg text-xs">
        <p className="font-bold text-text-primary">{d.subject}</p>
        <p style={{ color: getScoreColor(d.average) }} className="font-bold">Avg: {d.average}%</p>
        <p className="text-purple-600 font-bold">Best: {d.best}%</p>
        <p className="text-text-muted">{d.attempts} attempt{d.attempts !== 1 ? 's' : ''}</p>
      </div>
    );
  };

  return (
    <div className="mt-8 space-y-6">
      <h2 className="text-xl font-bold text-text-primary">My Performance Analytics</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map(card => (
          <div key={card.label} className={`rounded-xl border ${card.bg} p-4 transition-all hover:shadow-sm`}>
            <card.icon className={`h-5 w-5 ${card.color}`} />
            <p className={`mt-2 text-2xl font-black ${card.color}`}>
              {card.value}{card.unit}
            </p>
            <p className="text-xs font-bold text-text-secondary mt-0.5">{card.label}</p>
            {card.subtitle && (
              <p className="mt-0.5 text-[10px] text-text-muted">{card.subtitle}</p>
            )}
          </div>
        ))}
      </div>

      {/* Score Trend Line Chart */}
      {trendData.length >= 2 && (
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-primary">Score Trend</h3>
            <span className="text-xs text-text-muted">
              Last {trendData.length} exam{trendData.length !== 1 ? 's' : ''}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: any) => `${v}%`}
              />
              <Tooltip content={<TrendTooltip />} />
              <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="4 4" 
                             label={{ value: 'Pass (70%)', fill: '#22c55e', fontSize: 10 }} />
              <Line
                type="monotone"
                dataKey="percentage"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: '#2563eb' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Subject Performance Bar Chart */}
      {subjectData.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-text-primary">Subject Performance</h3>
          <ResponsiveContainer width="100%" height={Math.max(160, subjectData.length * 44)}>
            <BarChart
              data={subjectData}
              layout="vertical"
              margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#6b7280' }}
                     tickLine={false} axisLine={false} tickFormatter={(v: any) => `${v}%`} />
              <YAxis type="category" dataKey="subject" width={100}
                     tick={{ fontSize: 11, fill: '#374151' }} tickLine={false} axisLine={false} />
              <Tooltip content={<SubjectTooltip />} />
              <Bar dataKey="average" shape={<CustomBar />} radius={[0, 4, 4, 0]} 
                   label={{ position: 'right', fontSize: 11, fill: '#6b7280', formatter: (v: any) => `${v}%` }} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 flex items-center gap-4 text-xs font-medium text-text-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />≥70% (Good)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" />50–69% (Fair)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />&lt;50% (Needs Work)
            </span>
          </div>
        </div>
      )}

      {/* Exam History Table */}
      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-bold text-text-primary">Exam History</h3>
          <Link href="/results" className="text-xs font-bold text-primary hover:underline">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="px-4 py-3 text-left text-xs font-bold text-text-secondary uppercase">Exam</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-text-secondary uppercase">Type</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-text-secondary uppercase">Score</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-emerald-600 uppercase">✓</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-red-600 uppercase">✗</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-text-secondary uppercase">Date</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentResults.map((r: any) => (
                <tr key={r.sessionId} className="hover:bg-surface-2/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-bold text-text-primary max-w-[180px] truncate">{r.examTitle}</p>
                    <p className="text-xs text-text-muted">{r.subject}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      r.type === 'practice'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-purple-50 text-purple-700 border border-purple-200'
                    }`}>
                      {r.type === 'practice' ? 'Practice' : 'Exam'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`font-black ${
                      r.percentage >= 70 ? 'text-emerald-600' :
                      r.percentage >= 50 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {r.percentage}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-emerald-600 font-bold">{r.correct}</td>
                  <td className="px-3 py-3 text-center text-red-500 font-bold">{r.incorrect}</td>
                  <td className="px-3 py-3 text-xs text-text-muted whitespace-nowrap">
                    {formatDate(r.date)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      href={`/exam/result/${r.sessionId}`}
                      className="rounded-lg bg-surface-2 border border-border px-3 py-1 text-xs font-bold 
                                 text-text-primary hover:bg-border transition-colors whitespace-nowrap inline-block"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
