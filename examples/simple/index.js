let {ConsoleBrowser, ServerApp, InputForm} = require('../../');

let students = ['First', 'Second', 'Third'];

let app = new ServerApp();

app.use("/", (req, res) => {
    let links = {
        "f": "Form sample", 
        "f2": "Form sample many fields", 
        "n": "Just a state", 
        "e": "No handler error",
        "t": "Response timeout", 
        "r": "Redirect to n",
        "d": {
            description: "state link with data",
            data: {
                userId: 13,
                x: "Y",
            }
        },
        "rd": "Redirect to d with data",
        "rde": "Redirect to d with invalid data",
        "rde2": "Redirect to d with invalid data (circular structure)",
    };
    res.send("Hello!", links);
});

app.use("f", (req, res) => {
    let studentsListStr = "";
    for (let [i, st] of students.entries()) {
        studentsListStr += i + ". " + st + "\n";
    }
    let text = `Select student index:\n\n${studentsListStr}`;
    let indexForm = new InputForm("formaccept", {
        "index": "Index of student"
    });
    res.send(text, indexForm);
});

app.use("f2", (req, res) => {
    let text = 'Hello!';
    let form = new InputForm("formaccept", {
        "index": "Just",
        "name": "Student name",
        "score": "Hmmmm"
    });
    res.send(text, form);
});

app.use("n", (req, res) => {
    res.send("Next, please");
});

app.use("r", (req, res) => {
    res.redirect("n");
});

app.use("t", (req, res) => {
    void res;  // unused
    // error: no response
});

app.use("rd", (req, res) => {
    res.redirect("d", {some: "Data in redirect"});
});

app.use("rde", (req, res) => {
    res.redirect("d", "Invalid data here");
});

app.use("rde2", (req, res) => {
    const co = {};
    co.self = co;
    res.redirect("d", co);
});

app.use("d", (req, res) => {
    res.send(`Got some data with request ${JSON.stringify(req.data)}`);
});

app.use("formaccept", (req, res) => {
    let index = parseInt(req.data.index);
    if ((!index && index !== 0) || (index < 0 || index >= students.length)) {
        res.send("Invalid student index input: " + req.data.index);
    } else {
        res.send(`Data:\n${JSON.stringify(req.data, null, 4)}\nYou've selected student: ${students[index]}`);
    }
});

app.listen(80);

//

let browser = new ConsoleBrowser();
browser.open(80);