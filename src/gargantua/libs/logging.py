import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
import logging.handlers

from gargantua.tasks import delay_task
from gargantua.const import LOG_NAME


log = logging.getLogger(LOG_NAME)


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
        print('format record: {}'.format(record))
        return '<p>{}</p>'.format('</p><p>'.join(record.msg.split('\n')))

        # return logging.Formatter.format(self, _r)


def test_func():
    import time
    time.sleep(5)
    return time.time()

def callback(future):
    print('yeyeye: {}'.format(future.result()))



class LogMailHandler(logging.handlers.SMTPHandler):

    def emit(self, record):
        """
        self.mailhost
        self.mailport
        self.username
        self.password
        self.fromaddr
        self.toaddrs
        self.subject
        """
        # import pdb
        # pdb.set_trace()
        print('mail content: {}'.format(self.format(record)))
        delay_task(test_func)
        # delay_task(send_mail,
        #            mailhost=self.mailhost,
        #            mailport=self.mailport,
        #            username=self.username,
        #            passwd=self.password,
        #            fromaddr=self.fromaddr,
        #            toaddrs=self.toaddrs,
        #            subject=self.subject,
        #            content=record
        #            )
