import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Typography, 
  Table, 
  Button, 
  Tag, 
  Space, 
  Modal, 
  Tabs,
  Image,
  message,
  Badge
} from 'antd';
import { 
  CheckOutlined, 
  CloseOutlined, 
  EyeOutlined,
  UserOutlined,
  BookOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const AdminPanel = () => {
  const [pendingAccounts, setPendingAccounts] = useState([]);
  const [pendingCourses, setPendingCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accountsRes, coursesRes] = await Promise.all([
        axios.get('/api/admin/pending/accounts'),
        axios.get('/api/admin/pending/courses')
      ]);

      if (accountsRes.data.ok) {
        setPendingAccounts(accountsRes.data.data);
      }
      if (coursesRes.data.ok) {
        setPendingCourses(coursesRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
      message.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAccount = async (sid) => {
    try {
      const response = await axios.post(`/api/admin/pending/accounts/${sid}/approve`);
      if (response.data.ok) {
        message.success(`Account ${sid} approved successfully`);
        loadData();
      }
    } catch (err) {
      message.error('Failed to approve account');
    }
  };

  const handleRejectAccount = async (sid) => {
    Modal.confirm({
      title: 'Reject Account',
      content: `Are you sure you want to reject account ${sid}?`,
      onOk: async () => {
        try {
          const response = await axios.post(`/api/admin/pending/accounts/${sid}/reject`);
          if (response.data.ok) {
            message.success(`Account ${sid} rejected`);
            loadData();
          }
        } catch (err) {
          message.error('Failed to reject account');
        }
      },
    });
  };

  const handleApproveCourse = async (code) => {
    try {
      const response = await axios.post(`/api/admin/pending/courses/${code}/approve`);
      if (response.data.ok) {
        message.success(`Course ${code} approved successfully`);
        loadData();
      }
    } catch (err) {
      message.error('Failed to approve course');
    }
  };

  const handleRejectCourse = async (code) => {
    Modal.confirm({
      title: 'Reject Course',
      content: `Are you sure you want to reject course ${code}?`,
      onOk: async () => {
        try {
          const response = await axios.post(`/api/admin/pending/courses/${code}/reject`);
          if (response.data.ok) {
            message.success(`Course ${code} rejected`);
            loadData();
          }
        } catch (err) {
          message.error('Failed to reject course');
        }
      },
    });
  };

  const accountColumns = [
    {
      title: 'Student ID',
      dataIndex: 'sid',
      key: 'sid',
      render: (sid) => <Text strong>{sid}</Text>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Photo',
      key: 'photo',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => {
            setPreviewImage(record.photo_path || '');
            setPreviewVisible(true);
          }}
        >
          View
        </Button>
      ),
    },
    {
      title: 'Request Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => handleApproveAccount(record.sid)}
          >
            Approve
          </Button>
          <Button
            danger
            icon={<CloseOutlined />}
            onClick={() => handleRejectAccount(record.sid)}
          >
            Reject
          </Button>
        </Space>
      ),
    },
  ];

  const courseColumns = [
    {
      title: 'Course Code',
      dataIndex: 'code',
      key: 'code',
      render: (code) => <Text strong>{code}</Text>,
    },
    {
      title: 'Course Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Requested By',
      dataIndex: 'requestedBy',
      key: 'requestedBy',
    },
    {
      title: 'Request Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => handleApproveCourse(record.code)}
          >
            Approve
          </Button>
          <Button
            danger
            icon={<CloseOutlined />}
            onClick={() => handleRejectCourse(record.code)}
          >
            Reject
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <DashboardOutlined /> Admin Panel
        </Title>
        <Text type="secondary">Manage account and course requests</Text>
      </div>

      <Card>
        <Tabs defaultActiveKey="accounts">
          <TabPane
            tab={
              <span>
                <UserOutlined />
                Account Requests{' '}
                <Badge
                  count={pendingAccounts.length}
                  style={{ backgroundColor: '#1890ff' }}
                />
              </span>
            }
            key="accounts"
          >
            <Table
              columns={accountColumns}
              dataSource={pendingAccounts}
              rowKey="sid"
              loading={loading}
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: 'No pending account requests' }}
            />
          </TabPane>

          <TabPane
            tab={
              <span>
                <BookOutlined />
                Course Requests{' '}
                <Badge
                  count={pendingCourses.length}
                  style={{ backgroundColor: '#52c41a' }}
                />
              </span>
            }
            key="courses"
          >
            <Table
              columns={courseColumns}
              dataSource={pendingCourses}
              rowKey="code"
              loading={loading}
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: 'No pending course requests' }}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* Image Preview Modal */}
      <Modal
        open={previewVisible}
        title="Student Card Photo"
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        width={800}
      >
        {previewImage && (
          <Image
            src={previewImage}
            alt="Student Card"
            style={{ width: '100%' }}
          />
        )}
      </Modal>
    </div>
  );
};

export default AdminPanel;
