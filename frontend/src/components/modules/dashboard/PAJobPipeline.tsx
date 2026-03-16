// Job Pipeline Kanban — Project Associate Dashboard
// Workflow visualization: New → Documentation → Trip Created → In Transit → Closure Pending → Closed

import { useState } from 'react';
import { ChevronRight, MoreHorizontal } from 'lucide-react';

interface PipelineStage {
  id: string;
  title: string;
  color: string;
  count: number;
  jobs: any[];
}

interface Props {
  data: { stages: PipelineStage[] } | undefined;
  isLoading: boolean;
  navigate: (path: string) => void;
}

// Stage icons available for future column header enhancement
// const stageIcons: Record<string, React.ReactNode> = { ... };

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-400',
  low: 'bg-gray-400',
};

function PipelineSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-64 animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-3" />
          <div className="space-y-2">
            <div className="h-24 bg-gray-100 rounded-lg" />
            <div className="h-24 bg-gray-100 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PAJobPipeline({ data, isLoading, navigate }: Props) {
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});

  const totalJobs = data?.stages?.reduce((sum, s) => sum + s.count, 0) || 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">Job Pipeline</h3>
          <p className="text-sm text-gray-500">{totalJobs} jobs across all stages</p>
        </div>
        <button
          onClick={() => navigate('/jobs')}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          View All Jobs <ChevronRight size={16} />
        </button>
      </div>

      {/* Kanban Board */}
      <div className="p-4">
        {isLoading ? (
          <PipelineSkeleton />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin">
            {data?.stages?.map((stage) => {
              const displayJobs = showAll[stage.id] ? stage.jobs : stage.jobs.slice(0, 3);
              const hasMore = stage.jobs.length > 3;

              return (
                <div key={stage.id} className="flex-shrink-0 w-64">
                  {/* Stage Header */}
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="text-sm font-semibold text-gray-700 truncate">
                      {stage.title}
                    </span>
                    <span
                      className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${stage.color}15`,
                        color: stage.color,
                      }}
                    >
                      {stage.count}
                    </span>
                  </div>

                  {/* Stage Cards */}
                  <div className="space-y-2 min-h-[200px]">
                    {displayJobs.map((job: any) => (
                      <div
                        key={job.id}
                        onClick={() => navigate(`/jobs`)}
                        className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group"
                      >
                        {/* Job Number & Priority */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-900">
                            {job.job_number}
                          </span>
                          {job.priority && (
                            <div
                              className={`w-2 h-2 rounded-full ${priorityColors[job.priority] || 'bg-gray-400'}`}
                              title={`${job.priority} priority`}
                            />
                          )}
                        </div>

                        {/* Client */}
                        {job.client && (
                          <p className="text-xs text-gray-600 font-medium truncate mb-1">
                            {job.client}
                          </p>
                        )}

                        {/* Route or Details */}
                        {job.origin && job.destination && (
                          <p className="text-xs text-gray-400 truncate mb-2">
                            {job.origin} → {job.destination}
                          </p>
                        )}

                        {/* Trip info */}
                        {job.trip_number && (
                          <div className="text-xs text-gray-400 mb-1">
                            Trip: {job.trip_number}
                          </div>
                        )}

                        {/* Progress bar for in-transit */}
                        {typeof job.progress === 'number' && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-gray-500">Progress</span>
                              <span className="font-medium text-gray-700">{job.progress}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all bg-purple-500"
                                style={{ width: `${job.progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Pending items badges */}
                        {job.pending && Array.isArray(job.pending) && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {job.pending.map((p: string, i: number) => (
                              <span
                                key={i}
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Revenue for closed */}
                        {job.revenue && (
                          <div className="text-xs font-semibold text-emerald-600 mt-2">
                            ₹{Number(job.revenue ?? 0).toLocaleString('en-IN')}
                          </div>
                        )}

                        {/* Cargo/weight for new jobs */}
                        {job.cargo && job.weight && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              {job.cargo}
                            </span>
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              {job.weight}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Show more button */}
                    {hasMore && !showAll[stage.id] && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAll((prev) => ({ ...prev, [stage.id]: true }));
                        }}
                        className="w-full py-2 text-xs font-medium text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1 border border-dashed border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                      >
                        <MoreHorizontal size={14} />
                        {stage.count - 3} more
                      </button>
                    )}

                    {/* Empty state */}
                    {stage.jobs.length === 0 && (
                      <div className="flex items-center justify-center h-20 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
                        No jobs
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
