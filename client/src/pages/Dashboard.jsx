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
  Tag
} from 'antd';
import { 
  CalendarOutlined, 
  TeamOutlined, 
  FileTextOutlined, 
  FileOutlined,
  BookOutlined,
  ArrowRightOutlined,
  UserOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Title, Text } = Typography;

const Dashboard = () => {
  const [stats, setStats] = useState({
    courses: 0,
    groupRequests: 0,
    questionnaires: 0,
    materials: 0,
  });
  const [userInfo, setUserInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const sid = localStorage.getItem('sid');
      
      // Load user info
      const userResponse = await axios.get('/api/auth/me', {
        params: { sid }
      });
      
      if (userResponse.data.ok) {
        setUserInfo(userResponse.data.data);
      }

      // Load courses count
      try {
        const coursesResponse = await axios.get('/api/courses');
        if (coursesResponse.data.ok) {
          setStats(prev => ({ 
            ...prev, 
            courses: Object.keys(coursesResponse.data.data).length 
          }));
        }
      } catch (err) {
        console.log('Courses API might not be ready');
      }

      // Load group requests count
      try {
        const groupResponse = await axios.get('/api/group/requests');
        if (groupResponse.data.ok) {
          setStats(prev => ({ 
            ...prev, 
            groupRequests: groupResponse.data.data.length 
          }));
        }
      } catch (err) {
        console.log('Group API might not be ready');
      }

    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
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

  const recentCourses = [
    { code: 'AD113', title: 'Advanced Design', icon: <BookOutlined /> },
    { code: 'HD101', title: 'Human Development', icon: <BookOutlined /> },
    { code: 'CS101', title: 'Computer Science', icon: <BookOutlined /> },
  ];

  return (
    <div>
      {/* Welcome Section */}
      <div style={{ marginBottom: 32 }}>
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

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="My Courses"
              value={stats.courses}
              prefix={<BookOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Group Requests"
              value={stats.groupRequests}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Questionnaires"
              value={stats.questionnaires}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Materials"
              value={stats.materials}
              prefix={<FileOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Quick Actions */}
      <Card 
        title="Quick Actions" 
        style={{ marginBottom: 32 }}
        extra={<Link to="/calendar">View All</Link>}
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
                    height: '100%'
                  }}
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
            extra={<Link to="/materials">Browse All</Link>}
          >
            <List
              dataSource={recentCourses}
              renderItem={course => (
                <List.Item
                  actions={[
                    <Link to={`/courses/${course.code}`}>
                      <Button type="link">View</Button>
                    </Link>
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar icon={course.icon} />}
                    title={<Text strong>{course.code}</Text>}
                    description={course.title}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        
        <Col xs={24} md={8}>
          <Card title="Your Information">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>Student ID:</Text>
                <div>{userInfo.sid || 'N/A'}</div>
              </div>
              <div>
                <Text strong>Email:</Text>
                <div>{userInfo.email || 'N/A'}</div>
              </div>
              <div>
                <Text strong>Credits:</Text>
                <div>
                  <Tag color="blue">{userInfo.credits || 0} credits</Tag>
                </div>
              </div>
              {userInfo.major && (
                <div>
                  <Text strong>Major:</Text>
                  <div>{userInfo.major}</div>
                </div>
              )}
              
              <div style={{ marginTop: 16 }}>
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
          description="Welcome to EFS Platform! Start by exploring the timetable planner or updating your profile."
          type="info"
          showIcon
          style={{ marginTop: 32 }}
        />
      )}
    </div>
  );
};

export default Dashboard;
