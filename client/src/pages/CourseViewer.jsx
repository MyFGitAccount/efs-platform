import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Typography, 
  Button, 
  List, 
  Tag, 
  Space, 
  Table,
  Alert,
  Spin,
  Tabs,
  Badge
} from 'antd';
import { 
  ArrowLeftOutlined, 
  BookOutlined,
  FileOutlined,
  CalendarOutlined,
  PlayCircleOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Link } from 'react-router-dom';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const CourseViewer = () => {
  const { code } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('description');
  const navigate = useNavigate();

  useEffect(() => {
    loadCourse();
  }, [code]);

  const loadCourse = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/courses/${code}`);
      
      if (response.data.ok) {
        setCourse(response.data.data);
      } else {
        setCourse({
          code: code,
          title: 'Course Not Found',
          description: 'This course is not available yet.',
          materials: [],
          timetable: [],
        });
      }
    } catch (err) {
      console.error('Failed to load course:', err);
      setCourse({
        code: code,
        title: 'Error Loading Course',
        description: 'Failed to load course information.',
        materials: [],
        timetable: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const renderDescription = () => (
    <div>
      <Title level={4}>Course Description</Title>
      <div style={{ 
        background: '#fafafa', 
        padding: 24, 
        borderRadius: 8,
        border: '1px solid #f0f0f0'
      }}>
        {course.description || 'No description available for this course.'}
      </div>
    </div>
  );

  const renderMaterials = () => {
    if (!course.materials || course.materials.length === 0) {
      return (
        <Alert
          message="No Materials"
          description="No learning materials have been uploaded for this course yet."
          type="info"
          showIcon
        />
      );
    }

    return (
      <div>
        <Title level={4}>Course Materials</Title>
        <List
          dataSource={course.materials}
          renderItem={(material, index) => (
            <List.Item
              actions={[
                <Button 
                  type="link"
                  onClick={() => window.open(material.path, '_blank')}
                >
                  Download
                </Button>
              ]}
            >
              <List.Item.Meta
                avatar={<FileOutlined style={{ fontSize: 24 }} />}
                title={material.name}
                description={
                  <Space direction="vertical" size={0}>
                    <Text type="secondary">
                      Uploaded by {material.uploadedBy} • {new Date(material.uploadedAt).toLocaleDateString()}
                    </Text>
                    {material.description && (
                      <Text type="secondary">{material.description}</Text>
                    )}
                    <Space size="small">
                      <Tag color="blue">{material.size} KB</Tag>
                      <Tag color="green">{material.downloads || 0} downloads</Tag>
                    </Space>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </div>
    );
  };

  const renderTimetable = () => {
    if (!course.timetable || course.timetable.length === 0) {
      return (
        <Alert
          message="No Timetable"
          description="No schedule information available for this course."
          type="info"
          showIcon
        />
      );
    }

    const columns = [
      {
        title: 'Day',
        dataIndex: 'day',
        key: 'day',
      },
      {
        title: 'Time',
        dataIndex: 'time',
        key: 'time',
      },
      {
        title: 'Room',
        dataIndex: 'room',
        key: 'room',
      },
      {
        title: 'Class',
        dataIndex: 'classNo',
        key: 'classNo',
      },
    ];

    return (
      <div>
        <Title level={4}>Class Schedule</Title>
        <Table
          columns={columns}
          dataSource={course.timetable}
          rowKey={(record, index) => index}
          pagination={false}
          size="small"
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">Loading course information...</Text>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/dashboard')}
          style={{ marginBottom: 16 }}
        >
          Back to Dashboard
        </Button>
        
        <Title level={2}>
          <BookOutlined /> {course.code} - {course.title}
        </Title>
        
        <Space size="middle" style={{ marginTop: 8 }}>
          <Tag color="blue">
            <CalendarOutlined /> View in Timetable
          </Tag>
          <Link to="/group-formation">
            <Tag color="green">
              <TeamOutlined /> Find Study Group
            </Tag>
          </Link>
        </Space>
      </div>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane
            tab={
              <span>
                <BookOutlined />
                Description
              </span>
            }
            key="description"
          >
            {renderDescription()}
          </TabPane>
          
          <TabPane
            tab={
              <span>
                <FileOutlined />
                Materials{' '}
                <Badge
                  count={course.materials?.length || 0}
                  style={{ backgroundColor: '#1890ff' }}
                />
              </span>
            }
            key="materials"
          >
            {renderMaterials()}
          </TabPane>
          
          <TabPane
            tab={
              <span>
                <CalendarOutlined />
                Timetable
              </span>
            }
            key="timetable"
          >
            {renderTimetable()}
          </TabPane>
          
          <TabPane
            tab={
              <span>
                <PlayCircleOutlined />
                Mock Exercise
              </span>
            }
            key="mock"
          >
            <Alert
              message="Coming Soon"
              description="Mock exercises will be available soon for practice and self-assessment."
              type="info"
              showIcon
            />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default CourseViewer;
