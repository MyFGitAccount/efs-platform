import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Input,
  Select,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Upload,
  message,
  Badge,
  Avatar,
  Tooltip,
  Empty,
  Spin,
  Form,
  Input as AntInput,
} from 'antd';
import {
  SearchOutlined,
  UploadOutlined,
  DownloadOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  FileImageOutlined,
  FileTextOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import './Materials.css';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { Dragger } = Upload;
const { TextArea } = AntInput;

const Materials = () => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [sortBy, setSortBy] = useState('uploadedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [courses, setCourses] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadForm] = Form.useForm();
  const [userSid, setUserSid] = useState('');

  const fileTypeIcons = {
    'pdf': <FilePdfOutlined style={{ color: '#f40' }} />,
    'doc': <FileWordOutlined style={{ color: '#2b579a' }} />,
    'docx': <FileWordOutlined style={{ color: '#2b579a' }} />,
    'xls': <FileExcelOutlined style={{ color: '#217346' }} />,
    'xlsx': <FileExcelOutlined style={{ color: '#217346' }} />,
    'ppt': <FilePptOutlined style={{ color: '#d24726' }} />,
    'pptx': <FilePptOutlined style={{ color: '#d24726' }} />,
    'jpg': <FileImageOutlined style={{ color: '#d32f2f' }} />,
    'jpeg': <FileImageOutlined style={{ color: '#d32f2f' }} />,
    'png': <FileImageOutlined style={{ color: '#1976d2' }} />,
    'gif': <FileImageOutlined style={{ color: '#388e3c' }} />,
    'txt': <FileTextOutlined style={{ color: '#757575' }} />,
  };

  useEffect(() => {
    const sid = localStorage.getItem('sid');
    setUserSid(sid);
    loadMaterials();
    loadCourses();
  }, [filterCourse, sortBy, sortOrder]);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/materials/search', {
        params: {
          q: searchTerm,
          course: filterCourse,
          sortBy,
          sortOrder,
        }
      });

      if (response.data.ok) {
        setMaterials(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load materials:', err);
      message.error('Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const response = await axios.get('/api/courses');
      if (response.data.ok) {
        const courseList = Object.entries(response.data.data).map(([code, title]) => ({
          code,
          title,
        }));
        setCourses(courseList);
      }
    } catch (err) {
      console.error('Failed to load courses:', err);
    }
  };

  const getFileIcon = (filename) => {
    const extension = filename?.split('.').pop().toLowerCase() || '';
    return fileTypeIcons[extension] || <FileOutlined />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDownload = async (material) => {
    try {
      // Using the material ID for download
      const downloadUrl = `/api/materials/download/${material._id || material.id}`;
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', material.originalName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Update download count in UI
      setMaterials(prev => prev.map(m =>
        (m._id === material._id || m.id === material.id)
          ? { ...m, downloads: (m.downloads || 0) + 1 }
          : m
      ));

      message.success('Download started');
    } catch (err) {
      console.error('Download failed:', err);
      message.error('Failed to download file');
    }
  };

  const handleFileSelect = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        setSelectedFile({
          name: file.name,
          size: file.size,
          type: file.type,
          data: e.target.result // Base64 string
        });
        resolve(false); // Prevent default upload
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
        message.error('Failed to read file');
      };
      
      reader.readAsDataURL(file);
    });
  };

  const submitUpload = async () => {
    try {
      const values = await uploadForm.validateFields();
      
      if (!selectedFile) {
        message.warning('Please select a file first');
        return;
      }

      const uploadData = {
        fileData: selectedFile.data,
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
        courseCode: values.courseCode,
        name: values.name || selectedFile.name,
        description: values.description || '',
        tags: values.tags ? values.tags.split(',').map(tag => tag.trim()) : []
      };

      setUploading(true);
      
      const response = await axios.post(`/api/materials/course/${values.courseCode}`, uploadData, {
        headers: {
          'Content-Type': 'application/json',
          'x-sid': userSid,
        },
      });

      if (response.data.ok) {
        message.success('Material uploaded successfully');
        setUploadModalVisible(false);
        setSelectedFile(null);
        uploadForm.resetFields();
        loadMaterials();
      }
    } catch (err) {
      console.error('Upload failed:', err);
      message.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (material) => {
    try {
      Modal.confirm({
        title: 'Delete Material',
        content: `Are you sure you want to delete "${material.name}"? This action cannot be undone.`,
        okText: 'Delete',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk: async () => {
          const response = await axios.delete(`/api/materials/${material._id || material.id}`, {
            headers: {
              'x-sid': userSid,
            },
          });

          if (response.data.ok) {
            message.success('Material deleted successfully');
            loadMaterials();
          }
        },
      });
    } catch (err) {
      console.error('Delete failed:', err);
      message.error('Failed to delete material');
    }
  };

  const canDeleteMaterial = (material) => {
    return userSid === material.uploadedBy || localStorage.getItem('role') === 'admin';
  };

  const columns = [
    {
      title: 'File',
      key: 'file',
      render: (_, record) => (
        <div className="file-info">
          <Avatar 
            size="large" 
            icon={getFileIcon(record.originalName || record.fileName)}
            className="file-avatar"
          />
          <div className="file-details">
            <Text strong className="file-name">
              {record.name}
            </Text>
            <div className="file-meta">
              <Text type="secondary">{record.originalName || record.fileName}</Text>
              <Tag color="blue" size="small">
                {formatFileSize(record.size)}
              </Tag>
            </div>
          </div>
        </div>
      ),
      width: 300,
    },
    {
      title: 'Course',
      dataIndex: 'courseCode',
      key: 'courseCode',
      render: (code) => {
        const course = courses.find(c => c.code === code);
        return (
          <div>
            <Text strong>{code}</Text>
            {course && <div><Text type="secondary">{course.title}</Text></div>}
          </div>
        );
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text) => text || <Text type="secondary">No description</Text>,
    },
    {
      title: 'Uploaded By',
      dataIndex: 'uploadedBy',
      key: 'uploadedBy',
      render: (sid) => (
        <Tag color={sid === userSid ? 'green' : 'purple'}>{sid}</Tag>
      ),
    },
    {
      title: 'Downloads',
      dataIndex: 'downloads',
      key: 'downloads',
      render: (count) => (
        <Badge
          count={count || 0}
          style={{ backgroundColor: '#52c41a' }}
          showZero
        />
      ),
      align: 'center',
      sorter: (a, b) => (a.downloads || 0) - (b.downloads || 0),
    },
    {
      title: 'Upload Date',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      render: (date) => formatDate(date),
      sorter: (a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="Download">
            <Button
              type="primary"
              shape="circle"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
              size="small"
            />
          </Tooltip>
          {canDeleteMaterial(record) && (
            <Tooltip title="Delete">
              <Button
                danger
                shape="circle"
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
                size="small"
              />
            </Tooltip>
          )}
        </Space>
      ),
      align: 'center',
    },
  ];

  return (
    <div className="materials-page">
      <div className="materials-header">
        <div>
          <Title level={2}>Learning Materials</Title>
          <Text type="secondary">
            Access and share course materials with other students
          </Text>
        </div>
        
        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={() => setUploadModalVisible(true)}
        >
          Upload Material
        </Button>
      </div>

      <Card className="filters-card">
        <div className="filters-container">
          <div className="search-container">
            <Search
              placeholder="Search materials by name or description..."
              allowClear
              size="large"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onSearch={loadMaterials}
              style={{ width: 300 }}
            />
          </div>
          
          <div className="filter-controls">
            <Select
              placeholder="Filter by course"
              style={{ width: 200 }}
              value={filterCourse}
              onChange={setFilterCourse}
              allowClear
            >
              {courses.map(course => (
                <Option key={course.code} value={course.code}>
                  {course.code} - {course.title}
                </Option>
              ))}
            </Select>

            <Select
              placeholder="Sort by"
              style={{ width: 150 }}
              value={sortBy}
              onChange={setSortBy}
            >
              <Option value="uploadedAt">Upload Date</Option>
              <Option value="downloads">Downloads</Option>
              <Option value="name">Name</Option>
            </Select>

            <Button.Group>
              <Button
                type={sortOrder === 'asc' ? 'primary' : 'default'}
                onClick={() => setSortOrder('asc')}
                icon={<SortAscendingOutlined />}
              >
                Asc
              </Button>
              <Button
                type={sortOrder === 'desc' ? 'primary' : 'default'}
                onClick={() => setSortOrder('desc')}
                icon={<SortAscendingOutlined rotate={180} />}
              >
                Desc
              </Button>
            </Button.Group>

            <Button
              icon={<FilterOutlined />}
              onClick={loadMaterials}
              loading={loading}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </Card>

      <Card className="materials-list">
        <Table
          columns={columns}
          dataSource={materials}
          rowKey={(record) => record._id || record.id}
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} materials`,
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <Text>No materials found</Text>
                    <div style={{ marginTop: 16 }}>
                      <Button 
                        type="primary" 
                        onClick={() => setUploadModalVisible(true)}
                      >
                        Upload First Material
                      </Button>
                    </div>
                  </div>
                }
              />
            ),
          }}
          expandable={{
            expandedRowRender: (record) => (
              <div className="material-expanded">
                <div className="expanded-section">
                  <Text strong>Description:</Text>
                  <Text style={{ display: 'block', marginTop: 8 }}>
                    {record.description || 'No description provided'}
                  </Text>
                </div>
                
                {record.tags && record.tags.length > 0 && (
                  <div className="expanded-section">
                    <Text strong>Tags:</Text>
                    <div style={{ marginTop: 8 }}>
                      {record.tags.map((tag, index) => (
                        <Tag key={index} color="blue" style={{ marginBottom: 4 }}>
                          {tag}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="expanded-section">
                  <Text strong>File Information:</Text>
                  <div className="file-info-grid">
                    <div>
                      <Text type="secondary">Original Name:</Text>
                      <div>{record.originalName || record.fileName}</div>
                    </div>
                    <div>
                      <Text type="secondary">Size:</Text>
                      <div>{formatFileSize(record.size)}</div>
                    </div>
                    <div>
                      <Text type="secondary">Type:</Text>
                      <div>{record.mimetype || 'Unknown'}</div>
                    </div>
                    <div>
                      <Text type="secondary">Uploaded:</Text>
                      <div>{formatDate(record.uploadedAt)}</div>
                    </div>
                    <div>
                      <Text type="secondary">Storage:</Text>
                      <div>{record.storage || 'gridfs'}</div>
                    </div>
                    <div>
                      <Text type="secondary">Downloads:</Text>
                      <div>{record.downloads || 0}</div>
                    </div>
                  </div>
                </div>
              </div>
            ),
            rowExpandable: () => true,
          }}
        />
      </Card>

      {/* Upload Modal */}
      <Modal
        title="Upload Material"
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false);
          setSelectedFile(null);
          uploadForm.resetFields();
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setUploadModalVisible(false);
            setSelectedFile(null);
            uploadForm.resetFields();
          }}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={uploading}
            onClick={submitUpload}
            disabled={!selectedFile}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>,
        ]}
        width={600}
        destroyOnClose
      >
        <Form
          form={uploadForm}
          layout="vertical"
          initialValues={{ courseCode: filterCourse || '' }}
        >
          <Form.Item
            name="courseCode"
            label="Course"
            rules={[{ required: true, message: 'Please select a course' }]}
          >
            <Select
              placeholder="Choose a course"
              style={{ width: '100%' }}
            >
              {courses.map(course => (
                <Option key={course.code} value={course.code}>
                  {course.code} - {course.title}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="name"
            label="Material Name (Optional)"
            extra="Leave blank to use original filename"
          >
            <Input placeholder="Enter a custom name for the material" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description (Optional)"
          >
            <TextArea
              placeholder="Describe this material..."
              rows={3}
            />
          </Form.Item>

          <Form.Item
            name="tags"
            label="Tags (Optional)"
            extra="Comma-separated tags, e.g., lecture, notes, assignment"
          >
            <Input placeholder="Enter tags separated by commas" />
          </Form.Item>

          <Form.Item
            label="Upload File"
            rules={[{ required: true, message: 'Please select a file' }]}
          >
            <Dragger
              name="file"
              multiple={false}
              beforeUpload={handleFileSelect}
              onRemove={() => setSelectedFile(null)}
              fileList={selectedFile ? [{ 
                uid: '-1', 
                name: selectedFile.name,
                status: 'done'
              }] : []}
              className="upload-dragger"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt"
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">
                Click or drag file to this area to upload
              </p>
              <p className="ant-upload-hint">
                Support for PDF, Word, Excel, PowerPoint, Images, and Text files. Max file size: 20MB
              </p>
            </Dragger>
          </Form.Item>

          {selectedFile && (
            <div className="file-preview">
              <div className="preview-header">
                <Text strong>File Preview:</Text>
              </div>
              <div className="preview-content">
                <Avatar 
                  size={48} 
                  icon={getFileIcon(selectedFile.name)}
                  className="preview-avatar"
                />
                <div className="preview-details">
                  <Text strong>{selectedFile.name}</Text>
                  <Text type="secondary">
                    Size: {formatFileSize(selectedFile.size)}
                  </Text>
                  <Text type="secondary">
                    Type: {selectedFile.type || 'Unknown'}
                  </Text>
                </div>
              </div>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default Materials;