import React, { useState, useEffect, useRef } from 'react'; 
import { 
  Card, 
  Typography, 
  Alert, 
  Button, 
  Spin, 
  Input, 
  Select, 
  Tag, 
  Modal, 
  List, 
  Space,
  Tooltip,
  notification
} from 'antd';
import { 
  SearchOutlined, 
  DownloadOutlined, 
  ClearOutlined, 
  SaveOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import axios from 'axios';
import html2canvas from 'html2canvas';
import './Calendar.css';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

const Calendar = () => {
  const [courses, setCourses] = useState([]);
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarKey, setCalendarKey] = useState(0); // Force re-render
  const [useCalendarEventsAPI, setUseCalendarEventsAPI] = useState(false); // Toggle between APIs
  const calendarRef = useRef(null);

  const campusColors = {
    'ADC': '#3b82f6', // Blue
    'CIT': '#10b981', // Green
    'FTC': '#f59e0b', // Amber
    'HPC': '#ef4444', // Red
    'IEC': '#8b5cf6', // Purple
    'ISP': '#ec4899', // Pink
    'KEC': '#14b8a6', // Teal
    'KEE': '#f97316', // Orange
    'KEK': '#f97316', // Orange
    'KWC': '#84cc16', // Lime
    'UNC': '#06b6d4', // Cyan
    'SSC': '#8b5cf6', // Purple
  };

  useEffect(() => {
    loadCourses();
    loadSavedTimetable();
  }, []);

  useEffect(() => {
    filterCourses();
    checkConflicts();
    updateCalendarEvents();
  }, [searchTerm, selectedCourses]);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/calendar/courses');
      if (response.data.ok) {
        setCourses(response.data.data);
        setFilteredCourses(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load courses:', err);
      notification.error({
        message: 'Error',
        description: 'Failed to load courses. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSavedTimetable = async () => {
    try {
      const sid = localStorage.getItem('sid');
      if (!sid) return;

      const response = await axios.get('/api/calendar/mytimetable', {
        params: { sid }
      });

      if (response.data.ok && response.data.data.length > 0) {
        setSelectedCourses(response.data.data);
      }
    } catch (err) {
      console.error('Failed to load saved timetable:', err);
    }
  };

  const filterCourses = () => {
    if (!searchTerm.trim()) {
      setFilteredCourses(courses);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = courses.filter(course =>
      course.code.toLowerCase().includes(term) ||
      course.title.toLowerCase().includes(term) ||
      (course.classNo && course.classNo.toLowerCase().includes(term)) ||
      (course.campusShort && course.campusShort.toLowerCase().includes(term))
    );
    setFilteredCourses(filtered);
  };

  const checkConflicts = async () => {
    if (selectedCourses.length < 2) {
      setConflicts([]);
      return;
    }

    try {
      const response = await axios.post('/api/calendar/check-conflicts', {
        courses: selectedCourses
      });

      if (response.data.ok) {
        setConflicts(response.data.conflicts);
      }
    } catch (err) {
      console.error('Failed to check conflicts:', err);
    }
  };

  const updateCalendarEvents = () => {
    // If using the backend events API, fetch events from backend
    if (useCalendarEventsAPI) {
      fetchBackendEvents();
      return;
    }

    // Otherwise generate events locally
    generateLocalEvents();
  };

  const fetchBackendEvents = async () => {
    try {
      const response = await axios.get('/api/calendar/events');
      if (response.data.ok) {
        // Filter events to only include selected courses
        const selectedEventIds = selectedCourses.map(course => course.id);
        const filteredEvents = response.data.data.filter(event => {
          const courseCode = event.title.split(' - ')[0];
          return selectedCourses.some(course => course.code === courseCode);
        });
        setCalendarEvents(filteredEvents);
      }
    } catch (err) {
      console.error('Failed to fetch backend events:', err);
      generateLocalEvents();
    }
  };

  const generateLocalEvents = () => {
    const events = selectedCourses.map(course => {
      if (!course.startTime || !course.endTime || course.weekday === undefined) {
        return [];
      }

      const startTime = timeToMinutes(course.startTime);
      const endTime = timeToMinutes(course.endTime);

      // Create events for the current week
      const eventsForWeek = [];
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysUntilMonday = currentDay === 0 ? 1 : 1 - currentDay;
      const monday = new Date(now);
      monday.setDate(now.getDate() + daysUntilMonday);
      monday.setHours(0, 0, 0, 0);

      for (let i = 0; i < 7; i++) {
        const eventDate = new Date(monday);
        eventDate.setDate(monday.getDate() + i);

        // Convert weekday: backend uses 0=Sunday, 1=Monday, etc.
        if (eventDate.getDay() === (course.weekday === 0 ? 0 : course.weekday)) {
          const startDateTime = new Date(eventDate);
          startDateTime.setHours(Math.floor(startTime / 60), startTime % 60, 0, 0);

          const endDateTime = new Date(eventDate);
          endDateTime.setHours(Math.floor(endTime / 60), endTime % 60, 0, 0);

          const campusColor = campusColors[course.campusShort] || course.color || '#6b7280';

          eventsForWeek.push({
            id: `${course.id}-${i}`,
            title: `${course.code}${course.classNo ? ` - ${course.classNo}` : ''}`,
            extendedProps: {
              fullTitle: course.title,
              room: course.room,
              campus: course.campus,
              campusShort: course.campusShort,
              classNo: course.classNo,
              instructor: course.instructor || '',
              description: course.description || '',
            },
            start: startDateTime,
            end: endDateTime,
            backgroundColor: campusColor,
            borderColor: campusColor,
            textColor: '#ffffff',
            allDay: false,
          });
        }
      }

      return eventsForWeek;
    }).flat();

    setCalendarEvents(events);
    setCalendarKey(prev => prev + 1);
  };

  // Helper function to convert time string to minutes
  const timeToMinutes = (timeString) => {
    if (!timeString) return 0;
    
    // Handle both "09:30" and "9:30am" formats
    const timePart = timeString.split(' ')[0]; // Get "09:30" from "09:30am"
    const [hours, minutes] = timePart.split(':').map(Number);
    
    // Check if it's PM and adjust if needed
    if (timeString.toLowerCase().includes('pm') && hours < 12) {
      return (hours + 12) * 60 + (minutes || 0);
    }
    
    // Check if it's AM and hours is 12
    if (timeString.toLowerCase().includes('am') && hours === 12) {
      return 0 + (minutes || 0);
    }
    
    return hours * 60 + (minutes || 0);
  };

  const handleAddCourse = (course) => {
    if (selectedCourses.find(c => c.id === course.id)) {
      notification.warning({
        message: 'Course already added',
        description: 'This course is already in your timetable.',
      });
      return;
    }

    setSelectedCourses(prev => [...prev, course]);
    notification.success({
      message: 'Course added',
      description: `${course.code} added to timetable.`,
    });
  };

  const handleRemoveCourse = (courseId) => {
    setSelectedCourses(prev => prev.filter(c => c.id !== courseId));
  };

  const handleSaveTimetable = async () => {
    try {
      setSaving(true);
      const sid = localStorage.getItem('sid');
      
      if (!sid) {
        notification.error({
          message: 'Error',
          description: 'Please log in to save your timetable.',
        });
        return;
      }

      const response = await axios.post('/api/calendar/save', {
        sid,
        courses: selectedCourses
      });

      if (response.data.ok) {
        notification.success({
          message: 'Success',
          description: 'Timetable saved successfully!',
        });
      }
    } catch (err) {
      notification.error({
        message: 'Error',
        description: 'Failed to save timetable. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExportImage = async () => {
    try {
      const calendarElement = document.querySelector('.calendar-card');
      if (!calendarElement) {
        notification.warning({
          message: 'Warning',
          description: 'Calendar element not found for export.',
        });
        return;
      }

      const canvas = await html2canvas(calendarElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
      });

      const link = document.createElement('a');
      link.download = `my-timetable-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      notification.success({
        message: 'Success',
        description: 'Timetable exported as PNG!',
      });
    } catch (err) {
      console.error('Export failed:', err);
      notification.error({
        message: 'Error',
        description: 'Failed to export timetable.',
      });
    }
  };

  const handleClearAll = () => {
    Modal.confirm({
      title: 'Clear Timetable',
      content: 'Are you sure you want to clear all courses from your timetable?',
      onOk: () => {
        setSelectedCourses([]);
        notification.info({
          message: 'Timetable cleared',
          description: 'All courses have been removed.',
        });
      },
    });
  };

  const renderCourseItem = (course) => {
    const isAdded = selectedCourses.find(c => c.id === course.id);
    
    return (
      <Card 
        key={course.id}
        size="small"
        className={`course-card ${isAdded ? 'course-added' : ''}`}
        hoverable
        onClick={() => !isAdded && handleAddCourse(course)}
      >
        <div className="course-header">
          <div>
            <Typography.Text strong>
              {course.code} {course.classNo && `- ${course.classNo}`}
            </Typography.Text>
            <div className="course-title">{course.title}</div>
          </div>
          {isAdded ? (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              Added
            </Tag>
          ) : (
            <Button type="primary" size="small">
              Add
            </Button>
          )}
        </div>
        
        <div className="course-details">
          <Space size="small" wrap>
            <Tag color="blue">
              {course.day} {course.startTime}-{course.endTime}
            </Tag>
            <Tag color="purple">{course.room}</Tag>
            <Tag color="orange">{course.campusShort}</Tag>
          </Space>
        </div>
        
        {course.description && (
          <div className="course-description">
            <Typography.Text type="secondary" ellipsis>
              {course.description}
            </Typography.Text>
          </div>
        )}
        
        {isAdded && (
          <div className="course-actions">
            <Button 
              type="link" 
              danger 
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveCourse(course.id);
              }}
            >
              Remove
            </Button>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <div>
          <Title level={2}>
            <CalendarOutlined /> Timetable Planner
          </Title>
          <Text type="secondary">
            Drag and drop classes from the list to plan your schedule
          </Text>
        </div>
        
        <Space>
          <Tooltip title="Toggle between local and server-side event generation">
            <Button 
              icon={<InfoCircleOutlined />}
              onClick={() => setUseCalendarEventsAPI(!useCalendarEventsAPI)}
            >
              {useCalendarEventsAPI ? 'Using Server Events' : 'Using Local Events'}
            </Button>
          </Tooltip>
          <Button 
            icon={<SaveOutlined />}
            onClick={handleSaveTimetable}
            loading={saving}
            disabled={selectedCourses.length === 0}
          >
            Save Timetable
          </Button>
          <Button 
            icon={<DownloadOutlined />}
            onClick={handleExportImage}
            disabled={selectedCourses.length === 0}
          >
            Export as PNG
          </Button>
          <Button 
            icon={<ClearOutlined />}
            onClick={handleClearAll}
            danger
            disabled={selectedCourses.length === 0}
          >
            Clear All
          </Button>
        </Space>
      </div>

      {conflicts.length > 0 && (
        <Alert
          message="Timetable Conflicts Detected"
          description={
            <div>
              <p>The following courses have time conflicts:</p>
              <ul>
                {conflicts.map((conflict, index) => (
                  <li key={index}>
                    <strong>{conflict.course1}</strong> conflicts with{' '}
                    <strong>{conflict.course2}</strong> on {conflict.day} at {conflict.time}
                  </li>
                ))}
              </ul>
            </div>
          }
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          className="mb-4"
        />
      )}

      <div className="calendar-layout">
        {/* Left sidebar - Course list */}
        <div className="course-sidebar">
          <div className="sidebar-header">
            <Search
              placeholder="Search courses by code, name, or campus..."
              allowClear
              size="large"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onSearch={filterCourses}
              className="mb-3"
            />
            
            <div className="sidebar-stats">
              <Text type="secondary">
                Showing {filteredCourses.length} of {courses.length} courses
                {selectedCourses.length > 0 && ` • ${selectedCourses.length} selected`}
              </Text>
            </div>
          </div>

          <div className="course-list">
            {loading ? (
              <div className="loading-container">
                <Spin size="large" />
                <Text type="secondary">Loading courses...</Text>
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="empty-state">
                <Typography.Text type="secondary">
                  No courses found. Try a different search term.
                </Typography.Text>
              </div>
            ) : (
              filteredCourses.map(course => renderCourseItem(course))
            )}
          </div>
        </div>

        {/* Right side - Calendar */}
        <div className="calendar-container">
          <Card className="calendar-card">
            <div key={calendarKey}>
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'timeGridWeek,timeGridDay'
                }}
                events={calendarEvents}
                height="auto"
                slotMinTime="08:00:00"
                slotMaxTime="22:00:00"
                allDaySlot={false}
                weekends={true}
                editable={true}
                droppable={false}
                eventClick={(info) => {
                  Modal.info({
                    title: info.event.title,
                    content: (
                      <div>
                        <p><strong>Course:</strong> {info.event.extendedProps.fullTitle}</p>
                        <p><strong>Room:</strong> {info.event.extendedProps.room}</p>
                        <p><strong>Campus:</strong> {info.event.extendedProps.campus}</p>
                        <p><strong>Class:</strong> {info.event.extendedProps.classNo}</p>
                        <p><strong>Time:</strong> {info.event.start.toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })} - {info.event.end.toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}</p>
                        {info.event.extendedProps.description && (
                          <p><strong>Description:</strong> {info.event.extendedProps.description}</p>
                        )}
                      </div>
                    ),
                  });
                }}
                eventContent={(eventInfo) => (
                  <div className="calendar-event-content">
                    <div className="event-title">{eventInfo.event.title}</div>
                    <div className="event-room">{eventInfo.event.extendedProps.room}</div>
                    <div className="event-campus">{eventInfo.event.extendedProps.campusShort}</div>
                  </div>
                )}
                dayHeaderContent={(args) => (
                  <div className="day-header">
                    <div className="day-name">{args.text}</div>
                  </div>
                )}
              />
            </div>
          </Card>
          
          {/* Selected courses summary */}
          {selectedCourses.length > 0 && (
            <Card 
              title={`Selected Courses (${selectedCourses.length})`} 
              className="mt-4"
              size="small"
            >
              <List
                size="small"
                dataSource={selectedCourses}
                renderItem={course => (
                  <List.Item
                    actions={[
                      <Button 
                        type="link" 
                        danger 
                        size="small"
                        onClick={() => handleRemoveCourse(course.id)}
                      >
                        Remove
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      title={`${course.code} ${course.classNo ? `- ${course.classNo}` : ''}`}
                      description={
                        <Space size="small">
                          <Text type="secondary">{course.title}</Text>
                          <Tag size="small">{course.day} {course.startTime}-{course.endTime}</Tag>
                          <Tag size="small" color="blue">{course.room}</Tag>
                          <Tag size="small" color="orange">{course.campusShort}</Tag>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Calendar;