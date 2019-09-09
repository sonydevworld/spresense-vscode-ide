/****************************************************************************
 * serialTerminalr.c - Serial terminal
 *
 *   Copyright 2019 Sony Semiconductor Solutions Corporation
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in
 *    the documentation and/or other materials provided with the
 *    distribution.
 * 3. Neither the name of Sony Semiconductor Solutions Corporation nor
 *    the names of its contributors may be used to endorse or promote
 *    products derived from this software without specific prior written
 *    permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS
 * OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED
 * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 ****************************************************************************/

#include <fcntl.h>
#include <pthread.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <termios.h>
#include <unistd.h>

#include <sys/ioctl.h>

#define SERIAL_BUFFER_SIZE  128

typedef struct
{
    int     fd;         /* File descriptor */
    bool    enable;     /* Enable port */
    char    port[128];  /* Port device path */
    int     baudrate;   /* Baudrate */
    uint8_t nbit;       /* Character bit length (5 ~ 8) */
    char    parity;     /* Parity mode (None/Odd/Even) */
    uint8_t sbit;       /* Stop bit length (1 or 2) */
} serialSetting;

/**
 * Serial open
 */
int serialOpen(serialSetting *setting)
{
    int ret = 0;
    int modem_status = 0;
    speed_t baudrate;
    struct termios serial_tty;

    /* Open serial port */
    setting->fd = open(setting->port, O_RDWR | O_NDELAY | O_NOCTTY);
    if (setting->fd < 0) {
        /* Output error */
        perror(setting->port);
        return setting->fd;
    }

    /* Flush current buffer */
    tcflush(setting->fd, TCIOFLUSH);

    /* Get current serial settings */
    tcgetattr(setting->fd, &serial_tty);

    /* Select baudrate */
    switch (setting->baudrate)
    {
        case 4800:
            baudrate = B4800;
            break;
        case 9600:
            baudrate = B9600;
            break;
        case 19200:
            baudrate = B19200;
            break;
        case 38400:
            baudrate = B38400;
            break;
        case 57600:
            baudrate = B57600;
            break;
        case 115200:
            baudrate = B115200;
            break;
        default:
            printf("Not supported baudrate (%d)\n", setting->baudrate);
            return -1;
    }

    /* Set input baudrate */
    ret = cfsetispeed(&serial_tty, baudrate);
    if (ret < 0) {
        printf("Failed to set cfsetispeed\n");
        return ret;
    }

    /* Set output baudrate */
    ret = cfsetospeed(&serial_tty, baudrate);
    if (ret < 0) {
        printf("Failed to set cfsetospeed\n");
        return ret;
    }

    /* Enable receive*/
    serial_tty.c_cflag |= CREAD;

    /* Set character bit length */
    serial_tty.c_cflag &= ~CSIZE;
    switch (setting->nbit)
    {
        case 5:
            serial_tty.c_cflag |= CS5;
            break;
        case 6:
            serial_tty.c_cflag |= CS6;
            break;
        case 7:
            serial_tty.c_cflag |= CS7;
            break;
        case 8:
            serial_tty.c_cflag |= CS8;
            break;
        default:
            printf("Invalid character bit length (%d)\n", setting->nbit);
            return -1;
    }

    /* Set stopbit */
    if (setting->sbit == 1) {
        serial_tty.c_cflag &= ~CSTOPB;
    } else {
        serial_tty.c_cflag |= CSTOPB;
    }

    /* Set parity*/
    switch (setting->parity)
    {
        case 'N':
            serial_tty.c_cflag &= ~(PARENB | PARODD);
            break;
        case 'O':
            serial_tty.c_cflag |= PARENB | PARODD;
            break;
        case 'E':
            serial_tty.c_cflag |= PARENB;
            serial_tty.c_cflag &= ~PARODD;
            break;
    }

    /* Disable hardware flow control */
    serial_tty.c_cflag &= ~CRTSCTS;

    /* Ignore modem control */
    serial_tty.c_cflag |= CLOCAL;

    /* Reset output mode */
    serial_tty.c_oflag = 0;

    /* Reset line discipline mode */
    serial_tty.c_lflag = 0;

    /* Ignore break input signals */
    serial_tty.c_iflag = IGNBRK;

    /* Set configurated parameter */
    ret = tcsetattr(setting->fd, TCSANOW, &serial_tty);
    if (ret < 0) {
        printf("Failed to tcsetattr\n");
        return ret;
    }

    /* Get DTR status */
    ret = ioctl(setting->fd, TIOCMGET, &modem_status);
    if (ret < 0) {
        printf("Failed to ioctl TIOCMGET\n");
        return ret;
    }

    /* Set DTR enable */
    modem_status |= TIOCM_DTR;
    ret = ioctl(setting->fd, TIOCMSET, &modem_status);
    if (ret < 0) {
        printf("Failed to ioctl TIOCMGET\n");
        return ret;
    }

    /* Set DTR disable */
    modem_status &= ~TIOCM_DTR;
    ret = ioctl(setting->fd, TIOCMGET, &modem_status);
    if (ret < 0) {
        printf("Failed to ioctl TIOCMGET\n");
        return ret;
    }

    return ret;
}

/**
 * Serial port receive handler
 */
void *serialReceiver(void *arg)
{
    char receive_buff[SERIAL_BUFFER_SIZE];
    int size;
    serialSetting *setting = (serialSetting *)arg;

    while(setting->enable) {
        size = read(setting->fd, receive_buff, SERIAL_BUFFER_SIZE - 1);
        if (size > 0)
        {
            receive_buff[size] = '\0';
            printf("%s", receive_buff);
            fflush(stdout);
        }
        usleep(10 * 1000);
    }

    return NULL;
}

/**
 * Terminal
 */
void terminalMain(serialSetting *setting)
{
    int size = 0;
    int stdinfno = fileno(stdin);
    char buff[SERIAL_BUFFER_SIZE];
    struct termios terminal_tty, previous_tty;

    /* Get current terminal settings */
    tcgetattr(stdinfno, &terminal_tty);

    /* Backup terminal settings */
    memcpy(&previous_tty, &terminal_tty, sizeof(struct termios));

    /* Set terminal to RAW mode */
    cfmakeraw(&terminal_tty);

    /* Set terminal settings */
    tcsetattr(stdinfno, TCSANOW, &terminal_tty);

    /* Interactive loop */
    while(1) {
        size = read(stdinfno, buff, 1);
        if (size > 0) {
            /* Ctrl + C */
            if (buff[0] == 0x03) {
                printf("\r\n");
                break;
            }

            write(setting->fd, buff, size);
        }
    }

    /* Stop receiive handler */
    setting->enable = false;

    /* Recovery terminal settings */
    tcsetattr(stdinfno, TCSANOW, &previous_tty);
}

/**
 * Serial terminal
 * Options:
 *          -c: communication port (default: /dev/ttyUSB0)
 *          -b: Baudrate (default: 115200)
 *          -l: Character bit length (default: 8)
 *          -p: Parity mode N/O/E (default: N)
 *          -s: Stop bit (default: 1)
 */
int main(int argc, char* argv[])
{
    int ret = 0;
    int opt;
    pthread_t receive_thread;
    serialSetting setting =
    {
        .fd = 0,
        .enable = true,
        .port = "/dev/ttyUSB0",
        .baudrate = 115200,
        .nbit = 8,
        .parity = 'N',
        .sbit = 1
    };

    while ((opt = getopt(argc, argv, "b:c:l:p:s:")) != -1) {
        switch (opt)
        {
            case 'b':
                setting.baudrate = atoi(optarg);
                break;
            case 'c':
                strncpy(setting.port, optarg, 128);
                break;
            case 'l':
                setting.nbit = atoi(optarg);
                break;
            case 'p':
                setting.parity = optarg[0];
                break;
            case 's':
                setting.sbit = atoi(optarg);
                break;
        }
    }

    /* Open serial port by setting */
    ret = serialOpen(&setting);
    if (ret) {
        printf("Failed to setup serial port.\n");
        return ret;
    }

    /* Start to receive */
    pthread_create(&receive_thread, NULL, &serialReceiver, &setting.fd);

    /* Start terminal */
    terminalMain(&setting);

    /* Terminate thread */
    pthread_join(receive_thread, NULL);

    /* Close serial port */
    close(setting.fd);

    return ret;
}

