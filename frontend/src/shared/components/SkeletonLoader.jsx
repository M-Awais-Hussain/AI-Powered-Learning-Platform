import React from 'react';
import './SkeletonLoader.css';

/**
 * SkeletonStat - Skeleton for stat cards in the hero section
 */
export function SkeletonStat() {
    return (
        <div className="skeleton-stat">
            <div className="skeleton-icon shimmer" />
            <div className="skeleton-value shimmer" />
            <div className="skeleton-label shimmer" />
        </div>
    );
}

/**
 * SkeletonChart - Skeleton for chart cards
 */
export function SkeletonChart({ height = 300 }) {
    return (
        <div className="skeleton-chart-card">
            <div className="skeleton-chart-header">
                <div className="skeleton-title shimmer" />
            </div>
            <div className="skeleton-chart-body" style={{ height }}>
                <div className="skeleton-bars">
                    {[65, 80, 45, 90, 55, 70, 40].map((h, i) => (
                        <div
                            key={i}
                            className="skeleton-bar shimmer"
                            style={{ height: `${h}%` }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * SkeletonCard - Generic card skeleton
 */
export function SkeletonCard({ lines = 3 }) {
    return (
        <div className="skeleton-card">
            {Array.from({ length: lines }).map((_, i) => (
                <div
                    key={i}
                    className="skeleton-line shimmer"
                    style={{ width: `${90 - i * 15}%` }}
                />
            ))}
        </div>
    );
}

/**
 * SkeletonLeaderboard - Skeleton for leaderboard/list items
 */
export function SkeletonLeaderboard({ items = 5 }) {
    return (
        <div className="skeleton-leaderboard">
            {Array.from({ length: items }).map((_, i) => (
                <div key={i} className="skeleton-leaderboard-item">
                    <div className="skeleton-avatar shimmer" />
                    <div className="skeleton-name shimmer" />
                    <div className="skeleton-score shimmer" />
                </div>
            ))}
        </div>
    );
}

/**
 * DashboardSkeleton - Full dashboard skeleton layout
 */
export function DashboardSkeleton() {
    return (
        <div className="dashboard-skeleton">
            <div className="skeleton-hero shimmer" />
            <div className="skeleton-grid">
                <SkeletonChart />
                <SkeletonChart />
                <SkeletonChart />
                <SkeletonLeaderboard />
            </div>
        </div>
    );
}

export default { SkeletonStat, SkeletonChart, SkeletonCard, SkeletonLeaderboard, DashboardSkeleton };
