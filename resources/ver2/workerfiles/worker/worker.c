#include <errno.h>

#include <asmp/types.h>
#include <asmp/mpshm.h>
#include <asmp/mpmutex.h>
#include <asmp/mpmq.h>

#include "asmp.h"
#include "include/__app_name__.h"

#define ASSERT(cond) if (!(cond)) wk_abort()

static const char helloworld[] = "Hello, ASMP World!";

static char *strcopy(char *dest, const char *src)
{
  char *d = dest;
  while (*src) *d++ = *src++;
  *d = '\0';

  return dest;
}

int main(void)
{
  mpmutex_t mutex;
  mpshm_t shm;
  mpmq_t mq;
  uint32_t msgdata;
  char *buf;
  int ret;

  /* Initialize MP Mutex */

  ret = mpmutex_init(&mutex, __APP_NAME__KEY_MUTEX);
  ASSERT(ret == 0);

  /* Initialize MP message queue,
   * On the worker side, 3rd argument is ignored.
   */

  ret = mpmq_init(&mq, __APP_NAME__KEY_MQ, 0);
  ASSERT(ret == 0);

  /* Initialize MP shared memory */

  ret = mpshm_init(&shm, __APP_NAME__KEY_SHM, 1024);
  ASSERT(ret == 0);

  /* Map shared memory to virtual space */

  buf = (char *)mpshm_attach(&shm, 0);
  ASSERT(buf);

  /* Receive message from supervisor */

  ret = mpmq_receive(&mq, &msgdata);
  ASSERT(ret == MSG_ID___APP_NAME__);

  /* Copy hello message to shared memory */

  mpmutex_lock(&mutex);
  strcopy(buf, helloworld);
  mpmutex_unlock(&mutex);

  /* Free virtual space */

  mpshm_detach(&shm);

  /* Send done message to supervisor */

  ret = mpmq_send(&mq, MSG_ID___APP_NAME__, msgdata);
  ASSERT(ret == 0);

  return 0;
}

