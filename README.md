# Модуль **ClientView** (`webprogbase-client-view`)

## Мета

* Зрозуміти принципи комунікації інтерфейса користувача і основної частини програми через запити і відповіді (_HTTP Request\Response_)
* Обробка спрощеної вхідної інформації запиту від клієнта:
  * В який стан перейти (_Resource URI_)
  * Які вхідні дані опрацювати (_HTTP POST Request Body_)
* Передача спрощеної інформації клієнту через відповідь:
  * Який контент показати у поточному стані (_HTML_)
  * Які можливі переходи з поточного стану може вибрати клієнт (_HRef_)
  * В який стан автоматично перенаправити клієнта (_Redirect_)
  * Які дані клієнт має запитати у користувача (_HTML Form_) і в який стан клієнт має надіслати ці дані серверу після завершення вводу (_HTML Form Action_)

## Визначення

* __UI__ - інтерфейс користувача
* __Стан (State)__ - вершина графа, сторінка відображення інформації у UI
* __Посилання (Reference, Link)__ - дуга переходу від одного стану до іншого
* __Поле вводу (Input field)__ - елемент UI для введення користувачем певного значення. Ідентифікується строковим ключем, може мати текстовий опис.
* __Форма вводу (Input Form)__ - набір полів вводу з унікальними ключами.
* __Браузер (Browser)__ - у контексті даного документа - консольний модуль для відображення станів і взаємодії з користувачем.
* __Сервер (Server)__ - у контексті даного документа - модуль, що емулює клієнт-серверну взаємодію із браузером.
* __Запит (Request)__ - повідомлення від клієнта (браузера) до сервера.
* __Відповідь (Response)__ - повідомлення від сервера до клієнта як реакція на запит.
* __Перенаправлення (Redirect)__ - вказівка браузеру автоматично перейти у заданий стан.
* __API__ - програмний інтерфейс
* __Браузерна історія__ - послідовність станів, у які користувач переходив у браузері. Дозволяє користувачу повертатись до попередніх станів.

## Використання модуля

Модуль містить два основні класи:

* `ConsoleBrowser` - для ініціалізації консольного UI у вигляді спрощеного текстового "браузера". Об'єкти цього класу не вимагають розширення і є завершеними та готовими до використання.
* `ServerApp` - для створення спрощеного "сервера", що взаємодіє із консольним "браузером". Об'єкт цього класу можна розширювати через API програмуємою логікою для побудови власного "сервера", що взаємодіє із "браузером".

### Браузер

#### Граф станів UI

Інтерфейс програми, що відображатиметься у браузері проектується за допомогою графу станів зі станами двох видів:

* Простий стан із текстом та списком посилань на інші стани, у які браузер може перейти за вибором користувача.
* Стан форми вводу даних користувачем із автоматичним переходом у інший заданий стан та передачею йому введених даних.

#### Відображення та взаємодія користувача із браузером

1. Всі стани, по яких відбуваються переходи у браузері заносяться у _історію станів_. Для навігації по історії станів можна використовувати ключі спеціальних посилань, які автоматично підставляються у список посилань поточного стану, якщо вони доступні:

    * Перехід у початковий стан (`/`)
    * Перехід до попереднього стану (`<`)
    * Перехід до наступного стану (`>`)

1. При вводі даних у форму можна:

    * Повернутися до вводу попереднього поля (`<`). На першому полі це призведе до переходу до попереднього стану
    * Відмінити ввід у форму і повернутись до попереднього стану (`<<`)

### Сервер

Розроблювана програма (за допомогою побудови сервера) має реалізувати доступ до початкового стану з іменем `/`, до якого буде автоматично виконано запит браузером при старті (`ConsoleBrowser.open()`).  
Назви всіх інших станів довільні (окрім `/`, `<`, `>`).

## ServerApp

Потрібно підключити модуль та створити об'єкт:

```js
let {ServerApp} = require('webprogbase-console-view');

let app = new ServerApp();
```

### `use(stateName, stateHandler)`

Задати для стану (`stateName`) функцію-обробник (`stateHandler`).  
Обробник (`stateHandler(request, response)`) може приймати два параметри:

* `request` - об'єкт типу `Request`
* `response` - об'єкт типу `Response`

Приклад:

```js
app.use("/", onInitialState);

function onInitialState(req, res) {
    //
}

app.use("someState", function (req, res) {
    //
})

app.use("stateX", (req, res) => {
    //
});
```

### `listen(serverPort)`

Запустити роботу модуля після налаштування на порті з номером `serverPort`.  По цьому порту браузер зможе підключитись до сервера.

```js
app.listen(3000);  // now browser can connect to port 3000
```

## Request

Містить вхідну інформацію від браузера для виконання переходу у стан:

* `state` - (строка) назва стану, у який виконується перехід
* `data` - (об'єкт) словник вхідних даних стану (якщо є)

## Response

Дозволяє відповісти браузеру одним із трьох способів:

1. `response.redirect(stateName, stateData = null)`
1. `response.send(text, links)`
1. `response.send(text, form)`

### `redirect(stateName, stateData = null)`

Використовується для перенаправлення браузера (Redirect) у інший стан із можливістю передати у цей стан дані:

* `stateName` - (строка) у який стан перейти
* `stateData` - (об'єкт) які дані передати стану. Цей об'єкт не повинен містити циклічних посилань.

### `send(text, links)`

Використовується для передачі клієнту тексту для відображення та списку посилань на інші стани на вибір користувача:

* `text` - (строка) текст, який потрібно відобразити у поточному стані
* `links` - (об'єкт) словник переходів, що визначає, до яких станів клієнт може перейти із поточного стану. Ключі словника - назви станів. Значення словника:
  * Строка з описом стану
  * Об'єкт з інформацією про стан: опис (`description`) і дані (`data`), які передати у стан при переході. Дані повинні бути об'єктом без циклічних посилань.

Приклад:

```js
let links = {
    "create": "New student",
    "showAll": "Show all students",
    "getCurrentUser": {
        description: "Show info about some user",
        data: {
            userId: 42,
        }
    }
};
res.send("You are in main menu", links);
```

### `send(text, form)`

Використовується для передачі браузеру тексту для відображення та форми для вводу даних користувачем:

* `text` - (строка) текст, який відобразити у поточному стані перед вводом форми
* `form` - (об'єкт) об'єкт  типу `InputForm`, що описує форму вводу даних. Приймає у параметрах конструктора назву стану, якому надіслати введені дані та об'єкт з описом полів форми, де ключ - назва поля, а значення - короткий опис поля для виводу користувачу перед вводом.

Приклад:

```js
let nextState = "formProcessStateName";
let fields = {
    "name": "Enter student name",
    "score": "Enter score (int)",
};
let form = new InputForm(nextState, fields);
res.send("Some form text", form);
```

Замість строки із описом поля можна використати об'єкт з додатковою інформацією та налаштуваннями вводу значення у поле:

* `description` - (строка) опис поля
* `default` - (строка) підставиться у значення поля, якщо користувач введе пусте значення
* `auto` - (строка) автоматично підставиться у значення поля, ввід даних користувачем у дане поле пропускається

```js
let nextState = "formProcessStateName";
let fields = {
    "name": {
        description: "Enter student name",  
        default: "New Student",
    },
    "score": {
        description: "Enter score (int)",
        auto: "100",
    }
};
let form = new InputForm(nextState, fields);
res.send("Some form text", form);
```

Клас форми також підключається із модуля:

```js
let {InputForm} = require('webprogbase-console-view');
```

## ConsoleBrowser

Потрібно підключити модуль та створити об'єкт:

```js
let {ConsoleBrowser} = require('webprogbase-console-view');

let browser = new ConsoleBrowser();
```

### `open(serverPort)`

Дозволяє підключитись до сервера на заданому порті і виконати запит до початкового стану. При цьому сервер із таким портом вже має бути створений та запущений за допомогою `listen()`.

```js
server.listen(3000);

browser.open(1670);  // no connection
browser.open(3000);  // connected to server
```

## Помилки використання модуля

### Браузерні помилки

1. Спроба підключення до порта, на якому не слухає жодний сервер
1. Запит стану, для якого не було задано обробника на сервері
1. Відсутність відповіді сервера на запит браузера протягом певного часу (Timeout)

### Серверні помилки

Нижче описані помилки використання модуля сервера, які призводять до критичного завершення роботи всієї програми:

1. Спроба задати серверу більше одного обробника для будь-якого стану
1. Встановлення декількох відповідей через об'єкт Response у одній вітці виконання коду обробника запиту
1. Задана у відповіді форма вводу не містить полів.
1. Дані, що передаються у стан при перенаправленні або при переході по посиланню не є об'єктом, або містять циклічні посилання.