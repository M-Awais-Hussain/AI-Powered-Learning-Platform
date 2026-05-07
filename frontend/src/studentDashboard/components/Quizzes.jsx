import React from 'react';
import { Row, Col } from 'react-bootstrap';
import { LuClipboardList, LuZap, LuClock } from 'react-icons/lu';
import DashboardHero from '../../shared/components/DashboardHero';
import QuizCard from './QuizCard';

const Quizzes = ({ selectedGroup, quizzes }) => {
    const now = Math.floor(Date.now() / 1000);

    const activeQuizzesCount = quizzes.filter(q => {
        return (!q.start_time || now >= q.start_time) && (!q.end_time || now <= q.end_time);
    }).length;

    const pendingQuizzesCount = quizzes.filter(q => {
        const isActive = (!q.start_time || now >= q.start_time) && (!q.end_time || now <= q.end_time);
        return isActive && !q.has_submitted;
    }).length;

    return (
        <div>
            <DashboardHero
                icon={<LuClipboardList />}
                title="Available Quizzes"
                subtitle={`Assess your knowledge and track your progress in ${selectedGroup?.name || 'this group'}.`}
                stats={[
                    { icon: <LuClipboardList />, value: quizzes.length, label: "Total Quizzes" },
                    { icon: <LuZap />, value: activeQuizzesCount, label: "Active Now" },
                    { icon: <LuClock />, value: `${pendingQuizzesCount}`, label: "Pending" }
                ]}
            />

            {quizzes.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"></div>
                    <h4>No Quizzes Available</h4>
                    <p>Your teacher hasn't created any quizzes yet</p>
                </div>
            ) : (
                <Row>
                    {quizzes.map((quiz) => (
                        <Col md={6} lg={4} key={quiz.id} className="mb-3">
                            <QuizCard quiz={quiz} groupId={selectedGroup.id} />
                        </Col>
                    ))}
                </Row>
            )}
        </div>
    );
};

export default Quizzes;
