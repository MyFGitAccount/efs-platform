import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Alert, Card, Typography, Tag, Space, InputNumber } from 'antd';
import { PlusOutlined, CheckOutlined, LinkOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const { TextArea } = Input;

const Questionnaire = () => {
  const [questionnaires, setQuestionnaires] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [credits, setCredits] = useState(0);
  const [userSid, setUserSid] = useState('');

  useEffect(() => {
    const sid = localStorage.getItem('sid');
    setUserSid(sid);
    loadQuestionnaires();
    loadCredits();
  }, []);

  const loadQuestionnaires = async () => {
    try {
      const response = await axios.get('/api/questionnaire', {
        params: { sid: localStorage.getItem('sid') }
      });
      if (response.data.ok) {
        setQuestionnaires(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load questionnaires:', err);
    }
  };

  const loadCredits = async () => {
    try {
      const response = await axios.get('/api/me/credits', {
        params: { sid: localStorage.getItem('sid') }
      });
      if (response.data.ok) {
        setCredits(response.data.credits);
      }
    } catch (err) {
      console.error('Failed to load credits:', err);
    }
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const response = await axios.post('/api/questionnaire', {
        ...values,
        sid: userSid,
        creditsRequired: 3 // Cost to post a questionnaire
      });

      if (response.data.ok) {
        Modal.success({
          title: 'Success',
          content: 'Questionnaire posted successfully!',
        });
        setModalVisible(false);
        form.resetFields();
        loadQuestionnaires();
        loadCredits();
      }
    } catch (err) {
      Modal.error({
        title: 'Error',
        content: err.response?.data?.error || 'Failed to post questionnaire',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFillQuestionnaire = async (id) => {
    try {
      const response = await axios.post(`/api/questionnaire/${id}/fill`, {
        fillerSid: userSid
      });

      if (response.data.ok) {
        Modal.success({
          title: 'Success',
          content: 'Questionnaire filled! You earned 1 credit.',
        });
        loadQuestionnaires();
        loadCredits();
      }
    } catch (err) {
      Modal.error({
        title: 'Error',
        content: err.response?.data?.error || 'Failed to fill questionnaire',
      });
    }
  };

  const columns = [
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Link',
      dataIndex: 'link',
      key: 'link',
      render: (link) => (
        <a href={link} target="_blank" rel="noopener noreferrer">
          <LinkOutlined /> Open
        </a>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => {
        const filledBy = record.filledBy || [];
        const isFilledByUser = filledBy.includes(userSid);
        const isOwnQuestionnaire = record.creatorSid === userSid;
        
        if (isOwnQuestionnaire) {
          return (
            <Tag color="blue">
              Your questionnaire ({filledBy.length}/30 filled)
            </Tag>
          );
        }
        
        if (isFilledByUser) {
          return <Tag color="green">Filled by you</Tag>;
        }
        
        return <Tag color="orange">To be filled</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        const filledBy = record.filledBy || [];
        const isFilledByUser = filledBy.includes(userSid);
        const isOwnQuestionnaire = record.creatorSid === userSid;
        
        if (isOwnQuestionnaire) {
          return null;
        }
        
        if (isFilledByUser) {
          return <Tag color="success">Already filled</Tag>;
        }
        
        return (
          <Button
            type="primary"
            size="small"
            onClick={() => handleFillQuestionnaire(record._id)}
          >
            <CheckOutlined /> Fill
          </Button>
        );
      },
    },
  ];

  return (
    <div className="questionnaire-container">
      <Card>
        <div className="flex justify-between items-center mb-6">
          <div>
            <Title level={2}>Questionnaire Exchange</Title>
            <Text type="secondary">
              Earn credits by filling others' questionnaires, then use credits to post your own.
            </Text>
          </div>
          <div>
            <Tag color="blue" className="text-lg">
              Credits: {credits}
            </Tag>
          </div>
        </div>

        <Alert
          message="How it works"
          description="1. Fill questionnaires to earn 1 credit each. 2. Use 3 credits to post your own questionnaire. 3. Get responses from other users. 4. Track progress on your questionnaire."
          type="info"
          className="mb-6"
        />

        <div className="mb-6">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
            disabled={credits < 3}
          >
            Post New Questionnaire (Cost: 3 credits)
          </Button>
          {credits < 3 && (
            <Text type="secondary" className="ml-4">
              You need {3 - credits} more credits to post a questionnaire
            </Text>
          )}
        </div>

        <Table
          columns={columns}
          dataSource={questionnaires}
          rowKey="_id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="Post New Questionnaire"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
        >
          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter description' }]}
          >
            <TextArea rows={3} placeholder="Describe your questionnaire..." />
          </Form.Item>

          <Form.Item
            name="link"
            label="Questionnaire Link"
            rules={[
              { required: true, message: 'Please enter link' },
              { type: 'url', message: 'Please enter a valid URL' }
            ]}
          >
            <Input placeholder="https://forms.google.com/your-questionnaire" />
          </Form.Item>

          <Form.Item
            name="targetResponses"
            label="Target Responses"
            initialValue={30}
          >
            <InputNumber min={1} max={100} />
          </Form.Item>

          <Form.Item>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                Post Questionnaire (Cost: 3 credits)
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Questionnaire;
