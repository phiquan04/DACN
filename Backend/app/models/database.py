from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

# Initialize SQLAlchemy
db = SQLAlchemy()


def init_db(app):
    """Initialize database with Flask app"""
    db.init_app(app)
    with app.app_context():
        db.create_all()

class BaseModel(db.Model):
    """Base model for all models"""
    __abstract__ = True
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# class User(BaseModel):
#     """User model for chat history tracking"""
#     __tablename__ = 'users'
    
#     username = db.Column(db.String(80), unique=True, nullable=False)
#     email = db.Column(db.String(120), unique=True, nullable=False)
#     password_hash = db.Column(db.String(255), nullable=False)
#     is_active = db.Column(db.Boolean, default=True)
    
#     # Relationships
#     conversations = db.relationship('Conversation', backref='user', lazy=True, cascade='all, delete-orphan')
    
#     def __repr__(self):
#         return f'<User {self.username}>'


# class Conversation(BaseModel):
#     """Conversation/chat session model"""
#     __tablename__ = 'conversations'
    
#     title = db.Column(db.String(255), nullable=True)
#     user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
#     language = db.Column(db.String(10), default='ja')
    
#     # Relationships
#     messages = db.relationship('Message', backref='conversation', lazy=True, cascade='all, delete-orphan')
    
#     def __repr__(self):
#         return f'<Conversation {self.id}>'


# class Message(BaseModel):
#     """Message model - individual chat messages"""
#     __tablename__ = 'messages'
    
#     conversation_id = db.Column(db.Integer, db.ForeignKey('conversations.id'), nullable=True)
#     role = db.Column(db.String(20), nullable=False)  # 'user' or 'assistant'
#     content = db.Column(db.Text, nullable=False)
#     language = db.Column(db.String(10), default='ja')
#     confidence = db.Column(db.Float, nullable=True)
    
#     # Relationships
#     correction = db.relationship('GrammarCorrection', backref='message', uselist=False, cascade='all, delete-orphan')
    
#     def __repr__(self):
#         return f'<Message {self.id}>'


# class GrammarCorrection(BaseModel):
#     """Grammar correction history model"""
#     __tablename__ = 'grammar_corrections'
    
#     message_id = db.Column(db.Integer, db.ForeignKey('messages.id'), nullable=False)
#     original_text = db.Column(db.Text, nullable=False)
#     corrected_text = db.Column(db.Text, nullable=False)
#     errors = db.Column(db.JSON, nullable=True)  # Store error details
#     confidence = db.Column(db.Float, nullable=True)
#     error_count = db.Column(db.Integer, default=0)
    
#     def __repr__(self):
#         return f'<GrammarCorrection {self.id}>'


# class TranscriptionSession(BaseModel):
#     """Transcription session model - for YouTube/video transcription"""
#     __tablename__ = 'transcription_sessions'
    
#     source_url = db.Column(db.String(512), nullable=True)
#     source_type = db.Column(db.String(50), default='youtube')  # 'youtube' or 'file'
#     status = db.Column(db.String(50), default='pending')  # pending, processing, completed, failed
#     error_message = db.Column(db.Text, nullable=True)
#     segment_count = db.Column(db.Integer, default=0)
#     duration_ms = db.Column(db.Integer, nullable=True)
    
#     # Relationships
#     segments = db.relationship('TranscriptionSegment', backref='session', lazy=True, cascade='all, delete-orphan')
    
#     def __repr__(self):
#         return f'<TranscriptionSession {self.id}>'


# class TranscriptionSegment(BaseModel):
#     """Transcription segment model - individual segments from transcription"""
#     __tablename__ = 'transcription_segments'
    
#     session_id = db.Column(db.Integer, db.ForeignKey('transcription_sessions.id'), nullable=False)
#     start_time = db.Column(db.Float, nullable=False)  # In seconds
#     end_time = db.Column(db.Float, nullable=False)
#     japanese_text = db.Column(db.Text, nullable=False)
#     vietnamese_text = db.Column(db.Text, nullable=True)
#     confidence = db.Column(db.Float, nullable=True)
    
#     def __repr__(self):
#         return f'<TranscriptionSegment {self.id}>'


class Exam(db.Model):
    __tablename__ = 'exams'
 
    id         = db.Column(db.Integer, primary_key=True)
    title      = db.Column(db.String(255), nullable=False)   # "2010年7月 N1"
    level      = db.Column(db.String(10))                    # "N1", "N2"...
    year       = db.Column(db.Integer)
    month      = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
 
    # Relationship
    questions  = db.relationship(
        'Question',
        backref='exam',
        lazy='dynamic',          # query lười, không load hết ngay
        cascade='all, delete-orphan'
    )
 
    def to_dict(self, include_questions=False):
        data = {
            'id':             self.id,
            'title':          self.title,
            'level':          self.level,
            'year':           self.year,
            'month':          self.month,
            'created_at':     self.created_at.isoformat(),
            'question_count': self.questions.count(),
        }
        if include_questions:
            data['questions'] = [q.to_dict(include_choices=True) for q in self.questions.order_by(Question.question_no)]
        return data
 
    def __repr__(self):
        return f'<Exam {self.id}: {self.title}>'
 
 
class Question(db.Model):
    __tablename__ = 'questions'
 
    id            = db.Column(db.Integer, primary_key=True)
    exam_id       = db.Column(db.Integer, db.ForeignKey('exams.id', ondelete='CASCADE'), nullable=False)
    section       = db.Column(db.String(100))   # "言語知識", "読解", "聴解"
    question_no   = db.Column(db.Integer)        # 1, 2, 3...
    question_text = db.Column(db.Text, nullable=False)
    image_url     = db.Column(db.Text)           # tuỳ chọn nếu câu có hình
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
 
    # Relationships
    choices = db.relationship(
        'Choice',
        backref='question',
        lazy='joined',           # load cùng lúc với question
        cascade='all, delete-orphan',
        order_by='Choice.choice_no'
    )
    answer  = db.relationship(
        'Answer',
        backref='question',
        uselist=False,           # 1-1
        cascade='all, delete-orphan'
    )
 
    def to_dict(self, include_choices=False):
        data = {
            'id':            self.id,
            'exam_id':       self.exam_id,
            'section':       self.section,
            'question_no':   self.question_no,
            'question_text': self.question_text,
            'image_url':     self.image_url,
        }
        if include_choices:
            data['choices']     = [c.to_dict() for c in self.choices]
            data['correct_no']  = self.answer.correct_no  if self.answer else None
            data['explanation'] = self.answer.explanation if self.answer else None
        return data
 
    def __repr__(self):
        return f'<Question {self.question_no} (exam={self.exam_id})>'
 
 
class Choice(db.Model):
    __tablename__ = 'choices'
 
    id          = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id', ondelete='CASCADE'), nullable=False)
    choice_no   = db.Column(db.Integer, nullable=False)    # 1, 2, 3, 4
    choice_text = db.Column(db.Text, nullable=False)
 
    def to_dict(self):
        return {
            'choice_no':   self.choice_no,
            'choice_text': self.choice_text,
        }
 
    def __repr__(self):
        return f'<Choice {self.choice_no}: {self.choice_text[:30]}>'
 
 
class Answer(db.Model):
    __tablename__ = 'answers'
 
    id          = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id', ondelete='CASCADE'), nullable=False, unique=True)
    correct_no  = db.Column(db.Integer, nullable=False)   # 1, 2, 3 hoặc 4
    explanation = db.Column(db.Text)                       # giải thích đáp án
 
    def to_dict(self):
        return {
            'correct_no':  self.correct_no,
            'explanation': self.explanation,
        }
 
    def __repr__(self):
        return f'<Answer correct={self.correct_no} (question={self.question_id})>'
    
