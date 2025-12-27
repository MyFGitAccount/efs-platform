import React, { useState } from 'react';
import { 
  Card, 
  Typography, 
  Form, 
  Input, 
  Button, 
  message, 
  Space,
  Alert
} from 'antd';
import { 
  ArrowLeftOutlined, 
  BookOutlined,
  SaveOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Title, Text } = Typography;
const { TextArea } = Input;

const CourseEditor = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    
    try {
      const sid = localStorage.getItem('sid');
      const response = await axios.post('/api/courses/request', {
        code: values.code.toUpperCase().trim(),
        title: values.title.trim(),
      }, {
        headers: { 'x-sid': sid }
      });

      if (response.data.ok) {
        message.success('Course request submitted! Awaiting admin approval.');
        form.resetFields();
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      } else {
        message.error(response.data.error || 'Failed to submit request');
      }
    } catch (err) {
      console.error('Course request error:', err);
      message.error(err.response?.data?.error || 'Server error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          style={{ marginBottom: 16 }}
        >
          Back
        </Button>
        <Title level={2}>
          <BookOutlined /> Add New Course
        </Title>
        <Text type="secondary">
          Request a new course to be added to the platform
        </Text>
      </div>

      <Alert
        message="Note"
        description="Your course request will be reviewed by an administrator before being added to the platform."
        type="info"
        style={{ marginBottom: 24 }}
      />

      <Card>
        <Form
          form={form}
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="code"
            label="Course Code"
            rules={[
              { required: true, message: 'Please enter course code' },
              { pattern: /^[A-Z0-9]{2,6}$/, message: 'Course code should be 2-6 alphanumeric characters' }
            ]}
            help="e.g., AD113, HD101, CS101"
          >
            <Input 
              placeholder="Enter course code" 
              style={{ textTransform: 'uppercase' }}
            />
          </Form.Item>

          <Form.Item
            name="title"
            label="Course Title"
            rules={[
              { required: true, message: 'Please enter course title' },
              { min: 5, message: 'Title should be at least 5 characters' }
            ]}
            help="e.g., Advanced Design, Human Development, Computer Science 101"
          >
            <Input placeholder="Enter course title" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description (Optional)"
          >
            <TextArea 
              rows={4} 
              placeholder="Brief description of the course content, objectives, etc."
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 32 }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={loading}
              >
                Submit Request
              </Button>
              <Button onClick={() => navigate('/dashboard')}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default CourseEditor;
