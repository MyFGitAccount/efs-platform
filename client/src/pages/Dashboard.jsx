import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Typography, 
  Statistic, 
  Button, 
  Space, 
  List, 
  Avatar,
  Alert,
  Tag,
  Spin
} from 'antd';
import { 
  CalendarOutlined, 
  TeamOutlined, 
  FileTextOutlined, 
  FileOutlined,
  BookOutlined,
  ArrowRightOutlined,
  UserOutlined,
  DashboardOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api'; // Use the centralized API utility
import './Dashboard.css'; // Optional CSS file

const { Title, Text } = Typography;

const Dashboard = () => {
  const [stats, setStats] = useState({
    courses: 0,
    groupRequests: 0,
    questionnaires: 0,
    materials: 0,
  });
  const [userInfo, setUserInfo] = useState({});
  const [recentCourses, setRecentCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);
  const loadDashboardData = async () => {
  try {
    setLoading(true);
    const sid = localStorage.getItem('sid');
    
    if (!sid) {
      navigate('/login');
      return;
    }

    // Load comprehensive dashboard data
    const response = await api.get('/dashboard/summary');
    
    if (response.data.ok) {
      const data = response.data.data;
      
      // Set user info
      setUserInfo(data.user);
      
      // Set stats
      setStats({
        courses: data.stats.courses.enrolled,
        groupRequests: data.stats.groupRequests.myRequests,
        questionnaires: data.stats.questionnaires.myQuestionnaires,
        materials: data.stats.materials.myUploads,
      });
      
      // Set recent courses
      setRecentCourses(data.recentCourses);
      
      // Update last login time
      try {
        await api.put('/dashboard/update-last-login');
      } catch (err) {
        // Ignore error for non-critical update
      }
    }
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
    
    // If unauthorized, redirect to login
    if (err.response?.status === 401) {
      localStorage.clear();
      navigate('/login');
    } else {
      message.error('Failed to load dashboard data');
    }
  } finally {
    setLoading(false);
  }
};

  const loadCoursesStats = async () => {
    try {
      const response = await api.get('/courses');
      if (response.data.ok) {
        const courses = Object.values(response.data.data);
        setStats(prev => ({ 
          ...prev, 
          courses: courses.length 
        }));
        return courses;
      }
    } catch (err) {
      console.error('Failed to load courses:', err);
    }
    return [];
  };

  const loadGroupStats = async () => {
    try {
      const response = await api.get('/group/requests');
      if (response.data.ok) {
        setStats(prev => ({ 
          ...prev, 
          groupRequests: response.data.data.length 
        }));
      }
    } catch (err) {
      console.error('Failed to load group stats:', err);
    }
  };

  const loadQuestionnaireStats = async () => {
    try {
      const response = await api.get('/questionnaire/list');
      if (response.data.ok) {
        setStats(prev => ({ 
          ...prev, 
          questionnaires: response.data.data.length 
        }));
      }
    } catch (err) {
      console.error('Failed to load questionnaire stats:', err);
    }
  };

  const loadMaterialsStats = async () => {
    try {
      const response = await api.get('/materials/stats');
      if (response.data.ok) {
        setStats(prev => ({ 
          ...prev, 
          materials: response.data.data.totalMaterials || 0 
        }));
      }
    } catch (err) {
      console.error('Failed to load materials stats:', err);
    }
  };

  const loadRecentCourses = async () => {
    try {
      const response = await api.get('/materials/recent', {
        params: { limit: 5 }
      });
      
      if (response.data.ok) {
        // Get unique courses from recent materials
        const uniqueCourses = {};
        response.data.data.forEach(material => {
          if (material.courseCode && !uniqueCourses[material.courseCode]) {
            uniqueCourses[material.courseCode] = {
              code: material.courseCode,
              title: material.courseName || `Course ${material.courseCode}`,
              icon: <BookOutlined />,
              materialsCount: 0
            };
          }
          if (uniqueCourses[material.courseCode]) {
            uniqueCourses[material.courseCode].materialsCount++;
          }
        });
        
        setRecentCourses(Object.values(uniqueCourses).slice(0, 3));
      }
    } catch (err) {
      console.error('Failed to load recent courses:', err);
    }
  };

  const quickActions = [
    {
      title: 'Timetable Planner',
      description: 'Organize your weekly schedule',
      icon: <CalendarOutlined style={{ fontSize: 32, color: '#1890ff' }} />,
      link: '/calendar',
      color: '#1890ff',
    },
    {
      title: 'Group Formation',
      description: 'Find study partners',
      icon: <TeamOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
      link: '/group-formation',
      color: '#52c41a',
    },
    {
      title: 'Questionnaire Exchange',
      description: 'Share and fill surveys',
      icon: <FileTextOutlined style={{ fontSize: 32, color: '#722ed1' }} />,
      link: '/questionnaire',
      color: '#722ed1',
    },
    {
      title: 'Learning Materials',
      description: 'Access course resources',
      icon: <FileOutlined style={{ fontSize: 32, color: '#fa8c16' }} />,
      link: '/materials',
      color: '#fa8c16',
    },
  ];

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Welcome Section */}
      <div className="dashboard-header" style={{ marginBottom: 32 }}>
        <div className="welcome-section">
          <Title level={2}>
            <DashboardOutlined /> Dashboard
          </Title>
          <Text type="secondary">
            Welcome back, <Text strong>{userInfo.sid || 'Student'}</Text>!
            {userInfo.role === 'admin' && (
              <Tag color="red" style={{ marginLeft: 8 }}>Admin</Tag>
            )}
          </Text>
        </div>
        
        <Space>
          {userInfo.role === 'admin' && (
            <Button type="primary" onClick={() => navigate('/admin')}>
              Admin Panel
            </Button>
          )}
          <Button onClick={handleLogout}>
            Logout
          </Button>
        </Space>
      </div>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="My Courses"
              value={stats.courses}
              prefix={<BookOutlined />}
              valueStyle={{ color: '#1890ff' }}
              suffix={<Link to="/materials"><ArrowRightOutlined /></Link>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="Group Requests"
              value={stats.groupRequests}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
              suffix={<Link to="/group-formation"><ArrowRightOutlined /></Link>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="Questionnaires"
              value={stats.questionnaires}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#722ed1' }}
              suffix={<Link to="/questionnaire"><ArrowRightOutlined /></Link>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="Materials"
              value={stats.materials}
              prefix={<FileOutlined />}
              valueStyle={{ color: '#fa8c16' }}
              suffix={<Link to="/materials"><ArrowRightOutlined /></Link>}
            />
          </Card>
        </Col>
      </Row>

      {/* Quick Actions */}
      <Card 
        title="Quick Actions" 
        style={{ marginBottom: 32 }}
        extra={<Link to="/courses">View All Features</Link>}
      >
        <Row gutter={[16, 16]}>
          {quickActions.map((action, index) => (
            <Col xs={24} sm={12} md={6} key={index}>
              <Link to={action.link}>
                <Card
                  hoverable
                  style={{ 
                    textAlign: 'center',
                    border: `2px solid ${action.color}`,
                    height: '100%',
                    transition: 'transform 0.2s'
                  }}
                  className="quick-action-card"
                >
                  <div style={{ marginBottom: 16 }}>
                    {action.icon}
                  </div>
                  <Title level={4} style={{ color: action.color }}>
                    {action.title}
                  </Title>
                  <Text type="secondary">{action.description}</Text>
                  <div style={{ marginTop: 16 }}>
                    <Button type="link" icon={<ArrowRightOutlined />}>
                      Go
                    </Button>
                  </div>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Recent Courses & User Info */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={16}>
          <Card 
            title="Recent Courses" 
            extra={<Link to="/materials">Browse All Materials</Link>}
          >
            {recentCourses.length > 0 ? (
              <List
                dataSource={recentCourses}
                renderItem={course => (
                  <List.Item
                    actions={[
                      <Link to={`/materials/course/${course.code}`}>
                        <Button type="link">View Materials</Button>
                      </Link>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<Avatar icon={course.icon} />}
                      title={<Text strong>{course.code}</Text>}
                      description={
                        <div>
                          <div>{course.title}</div>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {course.materialsCount} material(s)
                          </Text>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Text type="secondary">No recent course materials found</Text>
                <div style={{ marginTop: '10px' }}>
                  <Button type="primary" onClick={() => navigate('/materials')}>
                    Browse Materials
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </Col>
        
        <Col xs={24} md={8}>
          <Card title="Your Information">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div className="user-info-item">
                <Text strong>Student ID:</Text>
                <div className="user-info-value">{userInfo.sid || 'N/A'}</div>
              </div>
              <div className="user-info-item">
                <Text strong>Email:</Text>
                <div className="user-info-value">{userInfo.email || 'N/A'}</div>
              </div>
              <div className="user-info-item">
                <Text strong>Credits:</Text>
                <div className="user-info-value">
                  <Tag color="blue">{userInfo.credits || 0} credits</Tag>
                </div>
              </div>
              {userInfo.major && (
                <div className="user-info-item">
                  <Text strong>Major:</Text>
                  <div className="user-info-value">{userInfo.major}</div>
                </div>
              )}
              
              <div style={{ marginTop: 24 }}>
                <Button 
                  type="primary" 
                  block
                  onClick={() => navigate('/profile')}
                  icon={<UserOutlined />}
                >
                  Update Profile
                </Button>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Welcome Alert for New Users */}
      {(!userInfo.sid || stats.courses === 0) && (
        <Alert
          message="Getting Started"
          description={
            <div>
              <p>Welcome to EFS Platform! Here are some suggestions to get started:</p>
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                <li>Update your profile with your major and year of study</li>
                <li>Browse learning materials for your courses</li>
                <li>Check the timetable planner to organize your schedule</li>
                <li>Join or create a study group</li>
              </ul>
            </div>
          }
          type="info"
          showIcon
          style={{ marginTop: 32 }}
        />
      )}
    </div>
  );
};

export default Dashboard;