import os
import smtplib
import asyncio
from email.message import EmailMessage
from typing import Optional
from dotenv import load_dotenv
load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "noreply@localhost")

def _send_smtp_email(to_email: str, subject: str, html_body: str) -> bool:
    """Synchronously send an email using SMTP"""
    if not SMTP_USER or not SMTP_PASSWORD:
        print("\n" + "="*50)
        print("DEBUG: SMTP_USER or SMTP_PASSWORD is not set.")
        print(f"DEBUG: To: {to_email}")
        print(f"DEBUG: Subject: {subject}")
        print(f"DEBUG: Content:\n{html_body}")
        print("="*50 + "\n")
        return False
        
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"Learning Platform <{SMTP_FROM_EMAIL}>"
    msg["To"] = to_email
    msg.set_content("Please enable HTML to view this email.")
    msg.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
            return True
    except Exception as e:
        print(f"Error sending email via SMTP: {e}")
        # Development fallback: Log the email content so verification links aren't lost
        print("\n" + "!"*20 + " EMAIL FALLBACK " + "!"*20)
        print(f"Subject: {subject}")
        print(f"To: {to_email}")
        print(f"HTML Content:\n{html_body}")
        print("!"*56 + "\n")
        return False

async def send_verification_email(email: str, full_name: str, token: str, base_url: str = "http://localhost:3000") -> bool:
    """Send verification email with the verification token"""
    verify_link = f"{base_url}/verify-email/{token}"
    
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to the Learning Platform, {full_name}!</h2>
        <p>Please verify your email address to get full access to your account.</p>
        <div style="margin: 30px 0;">
            <a href="{verify_link}" style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email Address</a>
        </div>
        <p>Or paste this link into your browser: <br> <a href="{verify_link}">{verify_link}</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>Thanks,<br>The Learning Platform Team</p>
    </div>
    """
    
    return await asyncio.to_thread(_send_smtp_email, email, "Verify your email address", html)

async def send_password_reset_email(email: str, token: str, base_url: str = "http://localhost:3000") -> bool:
    """Send password reset email with the reset token"""
    reset_link = f"{base_url}/reset-password/{token}"
    
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>We received a request to reset your password. If you didn't make this request, you can ignore this email.</p>
        <div style="margin: 30px 0;">
            <a href="{reset_link}" style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
        </div>
        <p>Or paste this link into your browser: <br> <a href="{reset_link}">{reset_link}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>Thanks,<br>The Learning Platform Team</p>
    </div>
    """
    
    return await asyncio.to_thread(_send_smtp_email, email, "Reset your password", html)
