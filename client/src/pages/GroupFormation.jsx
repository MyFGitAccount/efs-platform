import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Card,
  Tag,
  Space,
  Avatar,
  Drawer,
  Typography,
  Divider,
  Alert,
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const GroupFormation = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [userProfile, setUserProfile] = useState({});
  const [form] = Form.useForm();
  const [contactForm] = Form.useForm();

  useEffect(() => {
    loadRequests();
    loadUserProfile();
  }, []);

  const loadRequests = async () => {
    try {
      const response = await axios.get('/api/group/requests');
      if (response.data.ok) {
        setRequests(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load requests:', err);
    }
  };

  const loadUserProfile = async () => {
    try {
      const sid = localStorage.getItem('sid');
      const response = await axios.get('/api/me', {
        params: { sid }
      });
      if (response.data.ok) {
        setUserProfile(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const response = await axios.post('/api/group/requests', {
        ...values,
        sid: localStorage.getItem('sid'),
      });

      if (response.data.ok) {
        Modal.success({
          title: 'Success',
          content: 'Group request posted successfully!',
        });
        setModalVisible(false);
        form.resetFields();
        loadRequests();
      }
    } catch (err) {
      Modal.error({
        title: 'Error',
        content: err.response?.data?.error || 'Failed to post request',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContact = async (values) => {
    try {
      const response = await axios.post(`/api/group/requests/${selectedRequest._id}/contact`, {
        ...values,
        from_sid: localStorage.getItem('sid'),
        profile: userProfile,
      });

      if (response.data.ok) {
        Modal.success({
          title: 'Success',
          content: 'Invitation email sent successfully!',
        });
        setContactModalVisible(false);
        contactForm.resetFields();
      }
    } catch (err) {
      Modal.error({
        title: 'Error',
        content: err.response?.data?.error || 'Failed to send invitation',
      });
    }
  };

  const columns = [
    {
      title: 'Student',
      key: 'student',
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} />
          <div>
            <div>{record.sid}</div>
            <Text type="secondary">{record.major}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Major',
      dataIndex: 'major',
      key: 'major',
    },
    {
      title: 'Desired Groupmates',
      dataIndex: 'desired_groupmates',
      key: 'desired_groupmates',
      render: (text) => text || 'Not specified',
    },
    {
      title: 'Credentials',
      key: 'credentials',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          {record.gpa && <Text>GPA: {record.gpa}</Text>}
          {record.dse_score && <Text>DSE: {record.dse_score}</Text>}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setSelectedRequest(record);
              setDrawerVisible(true);
            }}
          >
            View Details
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<MessageOutlined />}
            onClick={() => {
              setSelectedRequest(record);
              setContactModalVisible(true);
            }}
          >
            Contact
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="group-formation-container">
      <Card>
        <div className="flex justify-between items-center mb-6">
          <div>
            <Title level={2}>Group Formation</Title>
            <Text type="secondary">
              Find study group partners from HKU SPACE. Post your request or contact others.
            </Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
          >
            Post Request
          </Button>
        </div>

        <Alert
          message="How it works"
          description="1. Post your group request with your major and preferences. 2. Browse other students' requests. 3. Contact potential groupmates via email. 4. Form study groups for your courses."
          type="info"
          className="mb-6"
        />

        <Table
          columns={columns}
          dataSource={requests}
          rowKey="_id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Request Details Drawer */}
      <Drawer
        title="Group Request Details"
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={500}
      >
        {selectedRequest && (
          <>
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Avatar size={64} icon={<UserOutlined />} />
                <div>
                  <Title level={4}>{selectedRequest.sid}</Title>
                  <Tag color="blue">{selectedRequest.major}</Tag>
                </div>
              </div>

              <Divider />

              <Space direction="vertical" size="middle" className="w-full">
                <div>
                  <Text strong>Description:</Text>
                  <div className="mt-1">{selectedRequest.description || 'No description'}</div>
                </div>

                <div>
                  <Text strong>Desired Groupmates:</Text>
                  <div className="mt-1">{selectedRequest.desired_groupmates || 'Not specified'}</div>
                </div>

                <div>
                  <Text strong>Credentials:</Text>
                  <div className="mt-1">
                    {selectedRequest.gpa && <div>GPA: {selectedRequest.gpa}</div>}
                    {selectedRequest.dse_score && <div>DSE Score: {selectedRequest.dse_score}</div>}
                  </div>
                </div>

                <div>
                  <Text strong>Contact Information:</Text>
                  <div className="mt-1">
                    <div><MailOutlined /> {selectedRequest.email}</div>
                    {selectedRequest.phone && <div><PhoneOutlined /> {selectedRequest.phone}</div>}
                  </div>
                </div>
              </Space>
            </div>

            <Button
              type="primary"
              block
              onClick={() => {
                setDrawerVisible(false);
                setContactModalVisible(true);
              }}
            >
              Contact This Student
            </Button>
          </>
        )}
      </Drawer>

      {/* Post Request Modal */}
      <Modal
        title="Post Group Request"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
          initialValues={{
            major: userProfile.major || '',
            email: userProfile.email || '',
            phone: userProfile.phone || '',
          }}
        >
          <Form.Item
            name="major"
            label="Major"
            rules={[{ required: true, message: 'Please enter your major' }]}
          >
            <Input placeholder="e.g., Computer Science, Business Administration" />
          </Form.Item>

          <Form.Item
            name="desired_groupmates"
            label="Desired Groupmates"
          >
            <Input placeholder="e.g., 2-3 students, prefer same major, available on weekends" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea
              rows={3}
              placeholder="Tell others about your study goals, preferred meeting times, etc."
            />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="gpa"
              label="GPA (optional)"
            >
              <InputNumber
                min={0}
                max={4}
                step={0.1}
                placeholder="3.5"
                className="w-full"
              />
            </Form.Item>

            <Form.Item
              name="dse_score"
              label="DSE Score (optional)"
            >
              <Input placeholder="25" />
            </Form.Item>
          </div>

          <Form.Item
            name="email"
            label="Contact Email"
            rules={[{ type: 'email', message: 'Invalid email' }]}
          >
            <Input prefix={<MailOutlined />} />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Phone (optional)"
          >
            <Input prefix={<PhoneOutlined />} placeholder="+852 1234 5678" />
          </Form.Item>

          <Form.Item>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                Post Request
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Contact Modal */}
      <Modal
        title={`Contact ${selectedRequest?.sid}`}
        open={contactModalVisible}
        onCancel={() => setContactModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form
          form={contactForm}
          onFinish={handleContact}
          layout="vertical"
        >
          <Alert
            message="An email will be sent to the student with your message and profile information."
            type="info"
            className="mb-4"
          />

          <Form.Item
            name="message"
            label="Personal Message"
          >
            <TextArea
              rows={4}
              placeholder={`Hi! I'd like to form a study group with you because...`}
            />
          </Form.Item>

          <div className="bg-gray-50 p-4 rounded mb-4">
            <Text strong>Your profile will be included:</Text>
            <div className="mt-2 text-sm">
              <div>Student ID: {userProfile.sid}</div>
              {userProfile.major && <div>Major: {userProfile.major}</div>}
              {userProfile.gpa && <div>GPA: {userProfile.gpa}</div>}
              {userProfile.email && <div>Email: {userProfile.email}</div>}
            </div>
          </div>

          <Form.Item>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setContactModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                Send Invitation
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GroupFormation;
