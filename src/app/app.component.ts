import {Component} from '@angular/core';
import {createMachine, interpret, assign, send} from 'xstate';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'session-app';
  machine: any;
  hasSession: boolean = false;
  hasSessionRefreshRequest: boolean = false;
  currentSessionTime = 0;
  maxSessionTime = 5;
  timeToExpire = 5;

  constructor() {
  }

  ngOnInit() {
    this.machine = interpret(createMachine(
      {
        id: 'timerSession',
        initial: 'stopped',
        context: {
          maxTimeout: 5000,
          sessionStartDateTime: 0,
        },
        states: {
          stopped: {
            entry: ['resetSessionStartTime'],
            on: {
              START_TIMER: 'running',
              EXIT_TIMER: 'exit',
            },
          },
          running: {
            entry: ['setSessionStartTime'],
            invoke: {
              src: 'sessionChecker',
            },
            on: {
              STOP_TIMER: 'stopped',
              REFRESH_TIMER: 'running',
              REQUEST_REFRESH: 'waitingRefresh',
            },
          },
          waitingRefresh: {
            entry: ['askForRefresh'],
            on: {
              STOP_TIMER: 'stopped',
              REFRESH_TIMER: 'running',
            },
            after: {
              WAITING_ANSWER_TIMEOUT: 'stopped',
            },
          },
          exit: {
            type: 'final',
          },
        },
      },
      {
        services: {
          sessionChecker: (context, event) => (callback, onReceive) => {

            onReceive((event) => {
              console.log('Recibiendo evento desde parent');
              if (event.type === 'REFRESH_TIMER') {
                callback('REFRESH_TIMER');
              }
            });

            const checker = setInterval(() => {
              const diff =
                Math.floor(new Date().getTime() / 1000) -
                context.sessionStartDateTime;
              console.log('difference', diff);

              this.currentSessionTime += 1; // tiempo acitivo
              this.timeToExpire = this.maxSessionTime - diff;

              if (diff > this.maxSessionTime) {
                callback('REQUEST_REFRESH');
              }
            }, 1000);

            return () => {
              clearInterval(checker);
            };
          },
        },
        actions: {
           askForRefresh: () => {
            this.askToContinue();
          },
          setSessionStartTime: assign((context, event) => {
            console.log('SESSION START / REFRESH TIME', event);

            const startDateTime = Math.floor(new Date().getTime() / 1000);
            sessionStorage.setItem('sessionStartDateTime', startDateTime.toString());
            this.timeToExpire = this.maxSessionTime;
            return {
              sessionStartDateTime: startDateTime
            };
          }),
          resetSessionStartTime: assign(() => {
            console.log('SESSION RESET TIME');
            this.currentSessionTime = 0;
            this.hasSession = false;
            this.hasSessionRefreshRequest = false;
            return {
              sessionStartDateTime: 0
            };
          })
        },
        delays: {
          WAITING_ANSWER_TIMEOUT: 5000,
        },
      }
    )).onTransition((event) => {
      console.warn('event', event.value)
    }).start();
  }

  doLogin() {
    console.log('haciendo LOGIN');
    setTimeout(() => {
      // request LOGIN TO BackEnd
      this.machine.send('START_TIMER');
      this.hasSession = true;
    }, 1000);
  }

  doLogout() {
    console.log('haciendo LOGOUT');
    // request LOGOUT TO BackEnd
    this.hasSessionRefreshRequest = false;
    this.hasSession = false;
    this.machine.send('STOP_TIMER');
  }

  askToContinue() {
    this.hasSessionRefreshRequest = true;
  }

  doRefresh() {
    this.hasSessionRefreshRequest = false;
    this.machine.send('REFRESH_TIMER');
  }
}
