import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
import logging.handlers

from gargantua.tasks import delay_task
from gargantua.utils import logger


def send_mail(mailhost, mailport, username, passwd,
              from_addr, to_addrs, subject, content):
    smtp = smtplib.SMTP(host="smtp.gmail.com", port=mailport)
    smtp.starttls()
    smtp.login(username, passwd)

    msg = MIMEMultipart('alternative')
    msg['From'] = from_addr
    msg['To'] = ';'.join(to_addrs)
    msg['Subject'] = subject
    msg.attach(MIMEText(content, 'html'))

    smtp.sendmail(from_addr, to_addrs, msg.as_string())
    smtp.quit()


class LogMailFormatter(logging.Formatter):

    def format(self, record):
        return '<p>{}</p>'.format('</p><p>'.join(record.msg.split('\n')))


class LogMailHandler(logging.handlers.SMTPHandler):

    def emit(self, record):
        logger.debug('delay_task for record {}'.format(record))
        delay_task(send_mail,
                   mailhost=self.mailhost,
                   mailport=self.mailport,
                   username=self.username,
                   passwd=self.password,
                   from_addr=self.fromaddr,
                   to_addrs=self.toaddrs,
                   subject=self.subject,
                   content=record
                   )
